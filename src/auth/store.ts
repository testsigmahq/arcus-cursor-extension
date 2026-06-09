import * as vscode from 'vscode';

const SECRET_REFRESH = 'arcus.refreshToken';
const SECRET_ACCESS = 'arcus.accessToken';

const STATE_KEY = 'arcus.authState';

export type AuthStatus = 'ok' | 'expired' | 'none';

export interface AuthState {
  uuid: string;
  accountId: string;
  userId: string;
  email: string;
  expiresAt: string; // ISO 8601
  authStatus: AuthStatus;
}

const EMPTY_STATE: AuthState = {
  uuid: '', accountId: '', userId: '', email: '', expiresAt: '', authStatus: 'none',
};

export class AuthStore {
  constructor(private context: vscode.ExtensionContext) {}

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.context.secrets.store(SECRET_ACCESS, accessToken);
    await this.context.secrets.store(SECRET_REFRESH, refreshToken);
  }

  async getAccessToken(): Promise<string> {
    return (await this.context.secrets.get(SECRET_ACCESS)) ?? '';
  }

  async getRefreshToken(): Promise<string> {
    return (await this.context.secrets.get(SECRET_REFRESH)) ?? '';
  }

  async clearTokens(): Promise<void> {
    await this.context.secrets.delete(SECRET_ACCESS);
    await this.context.secrets.delete(SECRET_REFRESH);
  }

  getState(): AuthState {
    return this.context.globalState.get<AuthState>(STATE_KEY) ?? { ...EMPTY_STATE };
  }

  async setState(patch: Partial<AuthState>): Promise<void> {
    const next = { ...this.getState(), ...patch };
    await this.context.globalState.update(STATE_KEY, next);
  }

  async clearState(): Promise<void> {
    await this.context.globalState.update(STATE_KEY, { ...EMPTY_STATE });
  }
}
