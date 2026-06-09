import * as vscode from 'vscode';

export class ReportPanel {
  private static current: ReportPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    panel.onDidDispose(() => { ReportPanel.current = undefined; });
  }

  static show(context: vscode.ExtensionContext, data: unknown): void {
    if (ReportPanel.current) {
      ReportPanel.current.panel.reveal(vscode.ViewColumn.Two);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'arcusReport',
        'Arcus Report',
        vscode.ViewColumn.Two,
        { enableScripts: false, retainContextWhenHidden: true },
      );
      ReportPanel.current = new ReportPanel(panel);
    }
    ReportPanel.current.render(data);
  }

  private render(data: unknown): void {
    this.panel.webview.html = buildHtml(data as Record<string, unknown>);
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtml(d: Record<string, unknown>): string {
  const verdict = String(d.verdict ?? d.status ?? 'UNKNOWN');
  const passRate = typeof d.pass_rate === 'number' ? Math.round(d.pass_rate * 100) : null;
  const flows = Array.isArray(d.flows) ? d.flows as Record<string, unknown>[] : [];
  const regressions = new Set<string>(
    Array.isArray(d.regressions) ? (d.regressions as string[]) : [],
  );

  const verdictColor = verdict === 'GO' ? '#22c55e' : verdict === 'NO GO' ? '#ef4444' : '#f59e0b';

  const rows = flows.map(f => {
    const name = String(f.name ?? f.flow_id ?? '');
    const result = String(f.result ?? f.status ?? '');
    const details = String(f.details ?? f.message ?? '');
    const isReg = regressions.has(name);
    return `<tr${isReg ? ' class="reg"' : ''}>
      <td>${esc(name)}${isReg ? ' <span class="reg-badge">REGRESSION</span>' : ''}</td>
      <td><span class="badge ${esc(result.toLowerCase())}">${esc(result)}</span></td>
      <td>${esc(details)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
  body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:24px;margin:0}
  .verdict{font-size:2rem;font-weight:700;color:${verdictColor};margin-bottom:4px}
  .meta{color:var(--vscode-descriptionForeground);margin-bottom:24px}
  h2{font-size:1rem;font-weight:600;margin:24px 0 8px}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border)}
  th{font-weight:600;color:var(--vscode-descriptionForeground);font-size:.85rem;text-transform:uppercase;letter-spacing:.05em}
  .badge{padding:2px 8px;border-radius:4px;font-size:.8rem;font-weight:500}
  .badge.pass{background:#14532d;color:#86efac}
  .badge.fail{background:#7f1d1d;color:#fca5a5}
  .badge.warning{background:#78350f;color:#fcd34d}
  .reg{background:rgba(239,68,68,.08)}
  .reg-badge{background:#7f1d1d;color:#fca5a5;padding:1px 6px;border-radius:4px;font-size:.75rem;margin-left:6px}
  .empty{color:var(--vscode-descriptionForeground);font-style:italic}
  pre{background:var(--vscode-textBlockQuote-background);padding:12px;border-radius:4px;overflow:auto;font-size:.85rem}
</style>
</head>
<body>
<div class="verdict">${esc(verdict)}</div>
<div class="meta">${passRate !== null ? `Pass rate: ${passRate}%` : ''}</div>

<h2>Test Flows</h2>
${flows.length === 0
  ? '<p class="empty">No flows in this report.</p>'
  : `<table><thead><tr><th>Flow</th><th>Result</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table>`}

<h2>Raw Response</h2>
<pre>${esc(JSON.stringify(d, null, 2))}</pre>
</body>
</html>`;
}
