import * as vscode from 'vscode';
import * as os from 'os';
import * as crypto from 'crypto';
import { LoopbackListener } from './loopbackListener';
import { buildAuthorizeUrl, exchangeCode, decodeJwtClaims } from './tokens';
import { AuthManager } from './authManager';
import { getServerUrl } from '../config/settings';
import { logger } from '../core/logger';

export type LoginResult =
  | { ok: true; email: string }
  | { ok: false; reason: string };

export async function runLogin(
  context: vscode.ExtensionContext,
  auth: AuthManager,
  version: string,
): Promise<LoginResult> {
  const serverUrl = getServerUrl();
  const uuid = crypto.randomUUID();
  const state = crypto.randomBytes(32).toString('base64url');

  const listener = new LoopbackListener(state, 300_000);
  const port = await listener.start();

  const authorizeUrl = buildAuthorizeUrl(serverUrl, {
    uuid, state, port, version, hostname: os.hostname(), type: 'CURSOR_EXTENSION',
  });
  logger.info(`Opening browser to ${authorizeUrl}`);
  await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl));

  const callback = await listener.waitForResult();
  listener.stop();
  if (!callback) return { ok: false, reason: 'Sign-in timed out (5 min).' };

  const code = String(callback.code ?? '');
  if (!code) return { ok: false, reason: 'Sign-in response missing code.' };

  const pair = await exchangeCode(serverUrl, uuid, code);
  if (!pair) return { ok: false, reason: 'Token exchange failed.' };

  const claims = decodeJwtClaims(pair.access_token);
  const accountId = String(claims.account_id ?? '').trim();
  const userId = String(claims.user_id ?? '').trim();
  if (!accountId || !userId) {
    return { ok: false, reason: 'Access token missing account_id / user_id.' };
  }

  const expiresAt = new Date(Date.now() + (pair.expires_in ?? 86400) * 1000).toISOString();
  await auth.store.setTokens(pair.access_token, pair.refresh_token);
  await auth.store.setState({
    uuid, accountId, userId,
    email: String(claims.email ?? ''),
    expiresAt, authStatus: 'ok',
  });

  // Rewrite the hook config so capture_hook.sh gets the new token.
  try {
    const cw = await import('../core/configWriter');
    await cw.writeHookConfig(context);
  } catch (err) {
    logger.error(`Hook config write after login failed: ${(err as Error).message}`);
  }

  return { ok: true, email: String(claims.email ?? userId) };
}
