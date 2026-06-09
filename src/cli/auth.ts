import { readSharedConfig, updateSharedTokens, markSharedExpired } from '../auth/sharedConfig';
import { refreshTokens } from '../auth/tokens';

export interface CliAuth {
  apiServer: string;
  token: string;
}

function notExpired(iso: string | undefined): boolean {
  if (!iso) return false;
  const exp = Date.parse(iso);
  if (Number.isNaN(exp)) return false;
  return Date.now() < exp - 60_000; // 60s skew
}

/** Resolve a usable access token from the shared store, refreshing if needed. */
export async function loadCliAuth(): Promise<CliAuth | null> {
  const creds = readSharedConfig();           // null unless auth_status==='ok' + refresh token present
  if (!creds) return null;
  const { config, refreshToken } = creds;
  const apiServer = config.api_server;
  if (!apiServer) return null;

  if (config.access_token && notExpired(config.access_expires_at)) {
    return { apiServer, token: config.access_token };
  }

  const pair = await refreshTokens(config.auth_server, config.uuid, refreshToken);
  if (!pair) { markSharedExpired(); return null; }
  if (!pair.access_token || !pair.refresh_token) { markSharedExpired(); return null; }
  const expiresIn = pair.expires_in ?? 86400;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  try {
    updateSharedTokens({ accessToken: pair.access_token, refreshToken: pair.refresh_token, expiresAt });
  } catch {
    return null;
  }
  return { apiServer, token: pair.access_token };
}
