import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { LoopbackListener } from '../auth/loopbackListener';
import { buildAuthorizeUrl, exchangeCode, decodeJwtClaims } from '../auth/tokens';
import { writeSharedConfig, clearSharedConfig } from '../auth/sharedConfig';
import { CmdResult } from './project';

// Defaults mirror src/config/settings.ts so a CLI sign-in lands on the same
// servers the Cursor extension uses. Env vars override for non-default deployments.
const DEFAULT_AUTH_SERVER = 'https://arcus.testsigma.com';
const DEFAULT_API_SERVER = 'https://agentic-test.testsigma.com';

export interface LoginDeps {
  authServer: string;
  apiServer: string;
  version: string;
  hostname: string;
  /** Side effect: open the SSO URL (a real browser, or a test driver). */
  openUrl: (url: string) => void;
  timeoutMs?: number;
  newUuid?: () => string;
  newState?: () => string;
}

/** Core sign-in flow, with side effects injected so it is testable end-to-end. */
export async function cliLogin(deps: LoginDeps): Promise<CmdResult> {
  const uuid = (deps.newUuid ?? (() => crypto.randomUUID()))();
  const state = (deps.newState ?? (() => crypto.randomBytes(32).toString('base64url')))();

  const listener = new LoopbackListener(state, deps.timeoutMs ?? 300_000);
  const port = await listener.start();

  const authorizeUrl = buildAuthorizeUrl(deps.authServer, {
    uuid, state, port, version: deps.version, hostname: deps.hostname, type: 'CURSOR_EXTENSION',
  });

  try {
    deps.openUrl(authorizeUrl);
  } catch {
    /* opener is best-effort; the URL is also printed below */
  }

  const callback = await listener.waitForResult();
  listener.stop();
  if (!callback) {
    return { code: 1, out: [], err: ['arcus: sign-in timed out (5 min). Re-run /arcus-login.'] };
  }

  const code = String(callback.code ?? '');
  if (!code) return { code: 1, out: [], err: ['arcus: sign-in response missing code.'] };

  const pair = await exchangeCode(deps.authServer, uuid, code);
  if (!pair) return { code: 1, out: [], err: ['arcus: token exchange failed.'] };

  const claims = decodeJwtClaims(pair.access_token);
  const accountId = String(claims.account_id ?? '').trim();
  const userId = String(claims.user_id ?? '').trim();
  if (!accountId || !userId) {
    return { code: 1, out: [], err: ['arcus: access token missing account_id / user_id.'] };
  }

  const email = String(claims.email ?? userId);
  const expiresAt = new Date(Date.now() + (pair.expires_in ?? 86400) * 1000).toISOString();
  try {
    writeSharedConfig({
      apiServer: deps.apiServer,
      authServer: deps.authServer,
      uuid, accountId, userId, email,
      accessToken: pair.access_token,
      refreshToken: pair.refresh_token,
      expiresAt,
    });
  } catch (err) {
    return { code: 1, out: [], err: [`arcus: failed to store credentials: ${(err as Error).message}`] };
  }

  return { code: 0, out: [`arcus: signed in as ${email}.`], err: [] };
}

/** Open a URL in the user's default browser, cross-platform, best-effort. */
function openExternal(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* ignore — the URL is printed for manual fallback */
  }
}

/** Read auth_server / api_server from an existing shared store, ignoring auth_status. */
function existingServers(): { authServer?: string; apiServer?: string } {
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), '.arcus', 'config.json'), 'utf8');
    const cfg = JSON.parse(raw) as { auth_server?: string; api_server?: string };
    return { authServer: cfg.auth_server, apiServer: cfg.api_server };
  } catch {
    return {};
  }
}

function cliVersion(): string {
  try {
    // package.json sits at the bundle root (dist/cli.js -> ../package.json) and
    // ships inside the .vsix, so this resolves both in dev and when installed.
    const raw = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Resolve real side effects and run the sign-in flow. Prints the URL for manual fallback. */
export async function loginCommand(io: { log: (s: string) => void }): Promise<CmdResult> {
  const existing = existingServers();
  const authServer = process.env.ARCUS_SERVER_URL || existing.authServer || DEFAULT_AUTH_SERVER;
  const apiServer = process.env.ARCUS_API_SERVER_URL || existing.apiServer || DEFAULT_API_SERVER;

  io.log('arcus: opening your browser to sign in (Testsigma SSO)…');
  return cliLogin({
    authServer,
    apiServer,
    version: cliVersion(),
    hostname: os.hostname(),
    openUrl: (url: string) => { io.log(`arcus: if the browser did not open, visit:\n  ${url}`); openExternal(url); },
  });
}

/** Clear every on-disk credential the CLI / extension share. */
export function cliLogout(): CmdResult {
  clearSharedConfig();
  try {
    fs.unlinkSync(path.join(os.homedir(), '.arcus', 'config'));
  } catch {
    /* already gone */
  }
  return { code: 0, out: ['arcus: signed out.'], err: [] };
}
