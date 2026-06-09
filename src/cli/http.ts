import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface CliResponse {
  status: number;
  body: unknown;
}

export function cliRequest(
  method: string,
  url: string,
  opts: { token: string; body?: unknown; timeoutMs?: number },
): Promise<CliResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? '443' : '80'),
        path: u.pathname + u.search,
        method,
        headers: {
          'x-agentic-token': opts.token,
          ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        },
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          let body: unknown = data;
          try { body = JSON.parse(data); } catch { /* keep raw string */ }
          resolve({ status: res.statusCode || 0, body });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(opts.timeoutMs ?? 20000, () => { req.destroy(); reject(new Error('timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
