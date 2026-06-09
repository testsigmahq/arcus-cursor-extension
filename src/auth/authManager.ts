import * as vscode from 'vscode';
import { AuthStore } from './store';
import { refreshTokens, decodeJwtClaims } from './tokens';
import { getServerUrl } from '../config/settings';
import { readSharedConfig } from './sharedConfig';
import { logger } from '../core/logger';

const SKEW_MS = 60_000;

export class AuthManager {
  readonly store: AuthStore;

  constructor(private context: vscode.ExtensionContext) {
    this.store = new AuthStore(context);
  }

  isSignedIn(): boolean {
    return this.store.getState().authStatus === 'ok';
  }

  /**
   * Adopt a sign-in performed by the arcus Copilot/CLI plugin. When this
   * extension has no local session but the shared store (~/.arcus/config.json
   * + refresh.token) holds a usable one, import it into SecretStorage +
   * globalState so the rest of the extension treats the user as signed in.
   * The two flows write the same shared contract, so this is symmetric.
   */
  async hydrateFromShared(): Promise<void> {
    if (this.isSignedIn()) return;

    const shared = readSharedConfig();
    if (!shared) return;

    const { config, refreshToken } = shared;
    await this.store.setTokens(config.access_token ?? '', refreshToken);
    await this.store.setState({
      uuid: config.uuid,
      accountId: config.account_id,
      userId: config.user_id,
      email: config.user_email,
      expiresAt: config.access_expires_at ?? config.expires_at,
      authStatus: 'ok',
    });
    logger.info(`Adopted shared sign-in for ${config.user_email || config.user_id}.`);
  }

  /** Returns a valid access token (refreshing if needed) and account id, or null. */
  async getValidAccessToken(): Promise<{ accessToken: string; accountId: string } | null> {
    const state = this.store.getState();
    if (state.authStatus === 'none') return null;

    const expiresAt = state.expiresAt ? Date.parse(state.expiresAt) : 0;
    const nearExpiry = !expiresAt || expiresAt - Date.now() <= SKEW_MS;

    if (nearExpiry) {
      const ok = await this.refresh();
      if (!ok) return null;
    }
    const accessToken = await this.store.getAccessToken();
    if (!accessToken) return null;
    return { accessToken, accountId: this.store.getState().accountId };
  }

  /** Forces a token refresh; persists new tokens + rewrites the hook config. Returns success. */
  async refresh(): Promise<boolean> {
    const state = this.store.getState();
    const refreshToken = await this.store.getRefreshToken();
    if (!refreshToken || !state.uuid) {
      await this.markExpired();
      return false;
    }
    const pair = await refreshTokens(getServerUrl(), state.uuid, refreshToken);
    if (!pair) {
      await this.markExpired();
      return false;
    }
    await this.store.setTokens(pair.access_token, pair.refresh_token);
    const claims = decodeJwtClaims(pair.access_token);
    const expiresAt = new Date(Date.now() + (pair.expires_in ?? 86400) * 1000).toISOString();
    await this.store.setState({
      expiresAt,
      authStatus: 'ok',
      accountId: String(claims.account_id ?? state.accountId),
      userId: String(claims.user_id ?? state.userId),
      email: String(claims.email ?? state.email),
    });
    try {
      const cw = await import('../core/configWriter');
      await cw.writeHookConfig(this.context);
    } catch (err) {
      logger.error(`Hook config rewrite after refresh failed: ${(err as Error).message}`);
    }
    return true;
  }

  private async markExpired(): Promise<void> {
    await this.store.setState({ authStatus: 'expired' });
  }

  async signOut(): Promise<void> {
    await this.store.clearTokens();
    await this.store.clearState();
    // Delete the on-disk credentials (~/.arcus/config + shared config.json +
    // refresh.token) rather than rewriting them empty. With no token present,
    // capture_hook.sh exits without posting, so events stop after sign-out.
    try {
      const cw = await import('../core/configWriter');
      cw.clearHookCredentials();
    } catch { /* ignore */ }
  }
}
