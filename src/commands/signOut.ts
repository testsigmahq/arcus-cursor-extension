import * as vscode from 'vscode';
import { AuthManager } from '../auth/authManager';

export function registerSignOutCommand(
  auth: AuthManager,
): vscode.Disposable {
  return vscode.commands.registerCommand('arcus.signOut', async () => {
    await auth.signOut();
    vscode.window.showInformationMessage('Arcus: signed out.');
  });
}
