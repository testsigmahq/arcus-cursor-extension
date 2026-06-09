import * as vscode from 'vscode';

export class StatusBarManager {
  readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'arcus.runTests';
    this.item.show();
  }

  setReady(changedFiles = 0): void {
    this.item.text = changedFiles > 0 ? `$(beaker) Arcus (${changedFiles})` : '$(beaker) Arcus';
    this.item.tooltip = changedFiles > 0 ? `${changedFiles} file(s) changed — click to run tests` : 'Click to run tests';
    this.item.backgroundColor = undefined;
  }

  setRunning(): void {
    this.item.text = '$(loading~spin) Arcus';
    this.item.tooltip = 'Running tests...';
    this.item.backgroundColor = undefined;
  }

  setDone(verdict?: string): void {
    const icon = verdict === 'NO GO' ? '$(error)' : verdict === 'REVIEW' ? '$(warning)' : '$(check)';
    this.item.text = `${icon} Arcus`;
    this.item.tooltip = verdict ? `Last run: ${verdict}` : 'Tests complete';
    this.item.backgroundColor =
      verdict === 'NO GO'
        ? new vscode.ThemeColor('statusBarItem.errorBackground')
        : undefined;
    setTimeout(() => this.setReady(), 8000);
  }

  setError(msg?: string): void {
    this.item.text = '$(error) Arcus';
    this.item.tooltip = msg || 'Error — click to retry';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    setTimeout(() => this.setReady(), 8000);
  }

  dispose(): void {
    this.item.dispose();
  }
}
