import * as vscode from 'vscode';

export function getServerUrl(): string {
  return vscode.workspace.getConfiguration('arcus').get<string>('serverUrl', 'https://tms-staging.testsigma.com');
}

export function getApiServerUrl(): string {
  return vscode.workspace.getConfiguration('arcus').get<string>('apiServerUrl', 'https://agentic-test-staging.testsigma.com');
}

export function getEventsPath(): string {
  return vscode.workspace.getConfiguration('arcus').get<string>('eventsPath', '/api/v1/plugin/events');
}

export function getEventsUrl(): string {
  return getApiServerUrl() + getEventsPath();
}

export function getLogLevel(): string {
  return vscode.workspace.getConfiguration('arcus').get<string>('logLevel', 'info');
}
