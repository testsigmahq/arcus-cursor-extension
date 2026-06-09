import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getApiServerUrl, getServerUrl } from '../config/settings';
import { AuthStore } from '../auth/store';
import { writeSharedConfig, clearSharedConfig } from '../auth/sharedConfig';
import type * as vscode from 'vscode';
export { writeCursorCommands } from './cursorCommands';

const CONFIG_PATH = path.join(os.homedir(), '.arcus', 'config');
const CURSOR_HOOKS_PATH = path.join(os.homedir(), '.cursor', 'hooks.json');

export async function writeHookConfig(context: vscode.ExtensionContext): Promise<void> {
  const serverUrl = getApiServerUrl();
  const store = new AuthStore(context);
  const accessToken = await store.getAccessToken();
  const state = store.getState();
  const accountId = state.accountId;

  const arcusDir = path.dirname(CONFIG_PATH);
  fs.mkdirSync(arcusDir, { recursive: true });

  const contents =
    `ARCUS_SERVER_URL=${serverUrl}\n` +
    `ARCUS_ACCESS_TOKEN=${accessToken}\n` +
    `ARCUS_ACCOUNT_ID=${accountId}\n`;
  fs.writeFileSync(CONFIG_PATH, contents, { encoding: 'utf8', mode: 0o600 });

  // Keep the shared credential store (config.json + refresh.token) in sync so
  // the arcus Copilot/CLI plugin honors a Cursor sign-in and vice versa.
  if (state.authStatus === 'ok' && accessToken) {
    writeSharedConfig({
      apiServer: getApiServerUrl(),
      authServer: getServerUrl(),
      uuid: state.uuid,
      accountId: state.accountId,
      userId: state.userId,
      email: state.email,
      accessToken,
      refreshToken: await store.getRefreshToken(),
      expiresAt: state.expiresAt,
    });
  } else {
    clearSharedConfig();
  }

  writeCursorHooks(context.extensionPath);
}

/**
 * Remove every on-disk credential so a signed-out machine sends nothing.
 * Deletes the bash hook's env file (~/.arcus/config) and the shared
 * config.json + refresh.token. The Cursor hook registration is intentionally
 * left in place — capture_hook.sh now no-ops when no token is present, so the
 * registered hooks become harmless rather than needing teardown here.
 */
export function clearHookCredentials(): void {
  try {
    fs.unlinkSync(CONFIG_PATH);
  } catch {
    /* already gone */
  }
  clearSharedConfig();
}

function writeCursorHooks(extensionPath: string): void {
  const script = path.join(extensionPath, 'hooks', 'capture_hook.sh');
  const cmd = `bash "${script}"`;

  const hooks = {
    version: 1,
    hooks: {
      sessionStart:        [{ type: 'command', command: cmd, timeout: 60 }],
      beforeSubmitPrompt:  [{ type: 'command', command: cmd, timeout: 30 }],
      afterAgentResponse:  [{ type: 'command', command: cmd, timeout: 30 }],
      afterAgentThought:   [{ type: 'command', command: cmd, timeout: 15 }],
      afterFileEdit:       [{ type: 'command', command: cmd, timeout: 30 }],
      // afterTabFileEdit:    [{ type: 'command', command: cmd, timeout: 30 }],
      preToolUse:          [{ type: 'command', command: cmd, timeout: 60, matcher: '*' }],
      postToolUse:         [{ type: 'command', command: cmd, timeout: 60, matcher: '*' }],
      stop:                [{ type: 'command', command: cmd, timeout: 30 }],
      sessionEnd:          [{ type: 'command', command: cmd, timeout: 10 }],
    },
  };

  const cursorDir = path.dirname(CURSOR_HOOKS_PATH);
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.writeFileSync(CURSOR_HOOKS_PATH, JSON.stringify(hooks, null, 2), 'utf8');
}
