import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

export interface JwtClaims {
  account_id?: string;
  user_id?: string;
  email?: string;
  [key: string]: unknown;
}

export interface AuthorizeParams {
  uuid: string;
  state: string;
  port: number;
  version: string;
  hostname: string;
  type: string;
}

/** Best-effort decode of a JWT body without signature verification. */
export function decodeJwtClaims(token: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    const body = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(body) as JwtClaims;
  } catch {
    return {};
  }
}

export function buildAuthorizeUrl(serverUrl: string, p: AuthorizeParams): string {
  const base = serverUrl.replace(/\/+$/, '');
  const qs = new URLSearchParams({
    uuid: p.uuid,
    type: p.type,
    state: p.state,
    port: String(p.port),
    v: p.version,
    hostname: p.hostname,
  });
  return `${base}/ui/agentic/authorize?${qs.toString()}`;
}

function getJson(url: string, timeoutMs = 10000): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? '443' : '80'),
        path: u.pathname + u.search,
        method: 'GET',
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          let body: unknown = data;
          try { body = JSON.parse(data); } catch { /* keep raw */ }
          resolve({ status: res.statusCode || 0, body });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function unwrapPair(body: unknown): TokenPair | null {
  const candidates: unknown[] = [body];
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    candidates.push((body as Record<string, unknown>).data);
  }
  for (const c of candidates) {
    if (c && typeof c === 'object') {
      const d = c as Record<string, unknown>;
      if (typeof d.access_token === 'string' && typeof d.refresh_token === 'string') {
        return {
          access_token: d.access_token,
          refresh_token: d.refresh_token,
          expires_in: typeof d.expires_in === 'number' ? d.expires_in : undefined,
        };
      }
    }
  }
  return null;
}

export async function exchangeCode(serverUrl: string, uuid: string, code: string): Promise<TokenPair | null> {
  const base = serverUrl.replace(/\/+$/, '');
  const url = `${base}/desktop/v1/${uuid}/tokens?${new URLSearchParams({ code })}`;
  try {
    const res = await getJson(url);
    if (res.status < 200 || res.status >= 300) return null;
    return unwrapPair(res.body);
  } catch {
    return null;
  }
}

export async function refreshTokens(serverUrl: string, uuid: string, refreshToken: string): Promise<TokenPair | null> {
  const base = serverUrl.replace(/\/+$/, '');
  const url = `${base}/desktop/v1/${uuid}/refresh?${new URLSearchParams({ refresh_token: refreshToken })}`;
  try {
    const res = await getJson(url);
    if (res.status < 200 || res.status >= 300) return null;
    return unwrapPair(res.body);
  } catch {
    return null;
  }
}
