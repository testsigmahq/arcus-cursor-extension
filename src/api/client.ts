import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

interface RequestOptions {
  method: string;
  url: string;
  body?: unknown;
  apiKey: string;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

export async function httpRequest(opts: RequestOptions): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.url);
    const bodyStr = opts.body ? JSON.stringify(opts.body) : undefined;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : '80'),
      path: url.pathname + url.search,
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, body: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout after 30s'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
