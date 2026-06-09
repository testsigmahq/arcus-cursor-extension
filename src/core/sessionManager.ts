import * as vscode from 'vscode';
import { randomUUID } from 'crypto';

export interface ChangeEntry {
  file: string;
  ts: string;
}

export class SessionManager {
  private _sessionId: string;
  private _changeLog: ChangeEntry[] = [];
  private _targetUrl: string | null;
  private _lastRunId: string | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this._sessionId = randomUUID();
    this._targetUrl = context.workspaceState.get<string>('arcus.targetUrl') ?? null;
  }

  get sessionId(): string { return this._sessionId; }
  get changeLog(): ChangeEntry[] { return [...this._changeLog]; }
  get targetUrl(): string | null { return this._targetUrl; }
  get lastRunId(): string | null { return this._lastRunId; }

  get cwd(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  }

  clear(): void {
    this._sessionId = randomUUID();
    this._changeLog = [];
    this._lastRunId = null;
  }

  addChange(filePath: string): void {
    this._changeLog = this._changeLog.filter(e => e.file !== filePath);
    this._changeLog.push({ file: filePath, ts: new Date().toISOString() });
  }

  async setTargetUrl(url: string): Promise<void> {
    this._targetUrl = url;
    await this.context.workspaceState.update('arcus.targetUrl', url);
  }

  setLastRunId(id: string): void {
    this._lastRunId = id;
  }
}
