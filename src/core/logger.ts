import * as vscode from 'vscode';
import { getLogLevel } from '../config/settings';

const channel = vscode.window.createOutputChannel('Arcus');

const LEVELS: Record<string, number> = { off: 0, error: 1, info: 2, debug: 3 };

function level(): number {
  return LEVELS[getLogLevel()] ?? 2;
}

export const logger = {
  debug: (msg: string) => { if (level() >= 3) channel.appendLine(`[DEBUG] ${msg}`); },
  info:  (msg: string) => { if (level() >= 2) channel.appendLine(`[INFO]  ${msg}`); },
  error: (msg: string) => { if (level() >= 1) channel.appendLine(`[ERROR] ${msg}`); },
};
