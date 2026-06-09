import * as vscode from 'vscode';
import { AuthManager } from '../auth/authManager';
import { runLogin } from '../auth/login';

export function registerSignInCommand(
  context: vscode.ExtensionContext,
  auth: AuthManager,
  version: string,
): vscode.Disposable {
  return vscode.commands.registerCommand('arcus.signIn', async () => {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Signing in to Arcus…', cancellable: false },
      () => runLogin(context, auth, version),
    );
    if (result.ok) {
      vscode.window.showInformationMessage(`Arcus: signed in as ${result.email}.`);
    } else {
      vscode.window.showErrorMessage(`Arcus: sign-in failed — ${result.reason}`);
    }
  });
}
