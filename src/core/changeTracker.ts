import * as vscode from 'vscode';
import { SessionManager } from './sessionManager';
import { EventsClient } from '../api/events';
import { logger } from './logger';

export class ChangeTracker {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private session: SessionManager,
    private events: EventsClient,
  ) {}

  start(context: vscode.ExtensionContext): void {
    const sub = vscode.workspace.onDidSaveTextDocument(doc => this.onSave(doc));
    this.disposables.push(sub);
    context.subscriptions.push(sub);
  }

  private async onSave(doc: vscode.TextDocument): Promise<void> {
    const filePath = doc.uri.fsPath;
    this.session.addChange(filePath);
    logger.debug(`Tracked change: ${filePath}`);

    await this.events.postToolUse({
      sessionId: this.session.sessionId,
      toolName: 'Write',
      toolInput: { file_path: filePath },
      toolResponse: 'File written successfully',
      cwd: this.session.cwd,
    });
  }

  stop(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
