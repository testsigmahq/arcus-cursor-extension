import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { SessionManager } from './core/sessionManager';
import { ChangeTracker } from './core/changeTracker';
import { EventsClient } from './api/events';
import { logger } from './core/logger';
import { writeHookConfig, writeCursorCommands } from './core/configWriter';
import { writeCursorSkills } from './core/cursorSkills';
import { AuthManager } from './auth/authManager';
import { readSharedConfig } from './auth/sharedConfig';
import { SharedStoreWatcher } from './auth/sharedStoreWatcher';
import { registerSignInCommand } from './commands/signIn';
import { registerSignOutCommand } from './commands/signOut';

let tracker: ChangeTracker | undefined;
let storeWatcher: SharedStoreWatcher | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info('Arcus activating');

  const version = (context.extension.packageJSON as { version?: string }).version ?? '0.0.0';
  const auth = new AuthManager(context);
  const session = new SessionManager(context);
  const events = new EventsClient(context, auth);

  tracker = new ChangeTracker(session, events);
  tracker.start(context);

  context.subscriptions.push(registerSignInCommand(context, auth, version));
  context.subscriptions.push(registerSignOutCommand(auth));

  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        const route = uri.path.replace(/^\/+/, '');
        if (route === 'signIn') {
          void vscode.commands.executeCommand('arcus.signIn');
        } else if (route === 'signOut') {
          void vscode.commands.executeCommand('arcus.signOut');
        } else {
          logger.info(`Ignoring unknown arcus URI route: ${uri.path}`);
        }
      },
    }),
  );

  await writeHookConfig(context);
  writeCursorCommands(context.extensionPath);
  writeCursorSkills(context.extensionPath);
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('arcus')) {
      writeHookConfig(context);
    }
  }, null, context.subscriptions);

  // Honor a sign-in performed by the arcus CLI / Copilot plugin (shared store).
  await auth.hydrateFromShared();

  // Proactively refresh so the hook config has a fresh token, then announce the session.
  const startSession = async (): Promise<void> => {
    await auth.getValidAccessToken();
    await writeHookConfig(context);
    await events.postSessionStart(session.sessionId, session.cwd);
    logger.info(`Session ${session.sessionId} started. Workspace: ${session.cwd}`);
  };

  // A sign-in landed in the shared store (CLI `arcus login`, or this window's
  // own command) — adopt it and start capturing without waiting for a reload.
  const onSignIn = async (): Promise<void> => {
    await auth.hydrateFromShared();
    if (!auth.isSignedIn()) return;
    logger.info('Adopted credentials from shared store; starting session.');
    await startSession();
  };

  // A sign-out landed in the shared store (CLI `arcus logout`, or another
  // window) — drop the in-memory token so every event post gates off at once.
  const onSignOut = async (): Promise<void> => {
    logger.info('Credentials removed from shared store; stopping event capture.');
    await auth.store.clearTokens();
    await auth.store.clearState();
  };

  // Keep this live session in lock-step with the shared store so login/logout
  // from ANY source (this window, another window, or the CLI) takes effect now.
  storeWatcher = new SharedStoreWatcher({
    isSignedIn: () => auth.isSignedIn(),
    hasSharedCreds: () => readSharedConfig() !== null,
    onSignIn,
    onSignOut,
  });
  storeWatcher.start(path.join(os.homedir(), '.arcus'));
  context.subscriptions.push({ dispose: () => storeWatcher?.stop() });

  if (!auth.isSignedIn()) {
    const action = await vscode.window.showWarningMessage(
      'Arcus: sign in to start capturing AI sessions.',
      { modal: false },
      'Sign In',
    );
    if (action === 'Sign In') {
      // The sign-in writes the shared store; the watcher adopts it and starts the session.
      await vscode.commands.executeCommand('arcus.signIn');
    }
    logger.info('Not signed in — watching for a sign-in from any source.');
    return;
  }

  await startSession();
}

export function deactivate(): void {
  tracker?.stop();
  storeWatcher?.stop();
}
