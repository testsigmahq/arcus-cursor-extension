import * as http from 'http';
import { AddressInfo } from 'net';

export interface AuthCallback {
  code: string;
  state: string;
  [key: string]: unknown;
}

/**
 * Single-use 127.0.0.1 listener for the auth callback. Accepts the first
 * POST /auth-token whose body's `state` matches, then resolves and stops.
 * Returns null from waitForResult() if nothing valid arrives before timeout.
 */
export class LoopbackListener {
  private server: http.Server | undefined;
  private result: AuthCallback | null = null;
  private resolveResult: ((v: AuthCallback | null) => void) | undefined;
  private timer: NodeJS.Timeout | undefined;

  constructor(private expectedState: string, private timeoutMs = 300000) {}

  start(): Promise<number> {
    return new Promise(resolve => {
      this.server = http.createServer((req, res) => this.handle(req, res));
      this.server.listen(0, '127.0.0.1', () => {
        const port = (this.server!.address() as AddressInfo).port;
        resolve(port);
      });
    });
  }

  private cors(res: http.ServerResponse, origin: string): void {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers.origin || '*';
    if (req.method === 'OPTIONS') {
      this.cors(res, origin);
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== 'POST' || req.url !== '/auth-token') {
      this.cors(res, origin);
      res.writeHead(404);
      res.end();
      return;
    }
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      let body: AuthCallback;
      try {
        body = JSON.parse(raw) as AuthCallback;
      } catch {
        this.cors(res, origin);
        res.writeHead(400);
        res.end('invalid json');
        return;
      }
      if (body.state !== this.expectedState) {
        this.cors(res, origin);
        res.writeHead(400);
        res.end('state mismatch');
        return;
      }
      this.result = body;
      this.cors(res, origin);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      this.finish(body);
    });
  }

  private finish(value: AuthCallback | null): void {
    if (this.timer) clearTimeout(this.timer);
    this.resolveResult?.(value);
    this.resolveResult = undefined;
    this.stop();
  }

  waitForResult(): Promise<AuthCallback | null> {
    if (this.result) return Promise.resolve(this.result);
    return new Promise(resolve => {
      this.resolveResult = resolve;
      this.timer = setTimeout(() => {
        this.resolveResult = undefined;
        resolve(null);
        this.stop();
      }, this.timeoutMs);
    });
  }

  stop(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    if (this.server) {
      try { this.server.close(); } catch { /* ignore */ }
      this.server = undefined;
    }
  }
}
