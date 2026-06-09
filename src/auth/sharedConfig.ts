import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The credential contract shared between the Cursor extension and the
 * arcus Copilot/CLI plugin. Both runtimes read and write these two files
 * under ~/.arcus so a sign-in from either flow is honored by the other:
 *
 *   config.json   - auth state (JSON; the plugin's schema, see scripts/auth/config.py)
 *   refresh.token - the refresh token (0600 file; the plugin's keystore fallback)
 *
 * The access token already lives plaintext in config.json, so colocating the
 * refresh token in a sibling 0600 file is consistent with that posture and is
 * the lowest-common-denominator store that both Node and Python can write.
 */
/** Compute paths at call time so tests can override HOME via process.env.HOME. */
function arcusPaths(): { dir: string; config: string; refresh: string } {
  const dir = path.join(os.homedir(), '.arcus');
  return { dir, config: path.join(dir, 'config.json'), refresh: path.join(dir, 'refresh.token') };
}

export interface SharedConfig {
  schema_version: number;
  api_server: string;
  auth_server: string;
  uuid: string;
  account_id: string;
  user_id: string;
  user_email: string;
  access_token?: string;
  access_expires_at?: string;
  expires_at: string;
  auth_status: 'ok' | 'expired' | 'revoked' | 'none';
}

export interface SharedCredentials {
  config: SharedConfig;
  refreshToken: string;
}

export interface WriteSharedInput {
  apiServer: string;
  authServer: string;
  uuid: string;
  accountId: string;
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO 8601
}

/** Mirror the Cursor auth state into the shared store the plugin reads. */
export function writeSharedConfig(input: WriteSharedInput): void {
  const { dir, config: configPath, refresh: refreshPath } = arcusPaths();
  fs.mkdirSync(dir, { recursive: true });

  const config: SharedConfig = {
    schema_version: 1,
    api_server: input.apiServer,
    auth_server: input.authServer,
    uuid: input.uuid,
    account_id: input.accountId,
    user_id: input.userId,
    user_email: input.email,
    access_token: input.accessToken || undefined,
    access_expires_at: input.expiresAt,
    expires_at: input.expiresAt,
    auth_status: 'ok',
  };

  // Atomic writes so a concurrent plugin reader never sees a half file.
  atomicWrite(configPath, JSON.stringify(config, null, 2));
  atomicWrite(refreshPath, input.refreshToken);
}

/** Read a sign-in performed by the plugin (or a prior Cursor session). */
export function readSharedConfig(): SharedCredentials | null {
  const { config: configPath, refresh: refreshPath } = arcusPaths();
  let config: SharedConfig;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as SharedConfig;
  } catch {
    return null;
  }
  if (config.auth_status !== 'ok') return null;

  let refreshToken = '';
  try {
    refreshToken = fs.readFileSync(refreshPath, 'utf8').trim();
  } catch {
    refreshToken = '';
  }
  if (!refreshToken) return null;

  return { config, refreshToken };
}

/** Remove the shared credentials (sign-out, or a failed/expired refresh). */
export function clearSharedConfig(): void {
  const { config: configPath, refresh: refreshPath } = arcusPaths();
  for (const p of [configPath, refreshPath]) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* already gone */
    }
  }
}

/** Mark the shared store expired so readSharedConfig() stops returning it (revoked/failed refresh). */
export function markSharedExpired(): void {
  const { config: configPath } = arcusPaths();
  let cfg: SharedConfig;
  try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')) as SharedConfig; } catch { return; }
  cfg.auth_status = 'expired';
  delete cfg.access_token;
  delete cfg.access_expires_at;
  atomicWrite(configPath, JSON.stringify(cfg, null, 2));
}

function atomicWrite(target: string, contents: string): void {
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contents, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, target);
}

/** Patch only the token fields in the shared store (used by the CLI after a refresh). */
export function updateSharedTokens(input: { accessToken: string; refreshToken: string; expiresAt: string }): void {
  const { config: configPath, refresh: refreshPath } = arcusPaths();
  const raw = fs.readFileSync(configPath, 'utf8');
  const cfg = JSON.parse(raw) as SharedConfig;
  cfg.access_token = input.accessToken;
  cfg.access_expires_at = input.expiresAt;
  cfg.expires_at = input.expiresAt;
  cfg.auth_status = 'ok';
  atomicWrite(configPath, JSON.stringify(cfg, null, 2));
  atomicWrite(refreshPath, input.refreshToken);
}
