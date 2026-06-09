import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { decodeJwtClaims, buildAuthorizeUrl, exchangeCode, refreshTokens } from '../../src/auth/tokens';

function makeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}

test('decodeJwtClaims extracts the body', () => {
  const jwt = makeJwt({ account_id: 'acct-1', user_id: 'u-1', email: 'a@b.com' });
  const claims = decodeJwtClaims(jwt);
  assert.equal(claims.account_id, 'acct-1');
  assert.equal(claims.user_id, 'u-1');
  assert.equal(claims.email, 'a@b.com');
});

test('decodeJwtClaims returns {} on malformed token', () => {
  assert.deepEqual(decodeJwtClaims('not-a-jwt'), {});
  assert.deepEqual(decodeJwtClaims(''), {});
});

test('buildAuthorizeUrl assembles all params', () => {
  const url = buildAuthorizeUrl('https://host.example/', {
    uuid: 'U', state: 'S', port: 5000, version: '0.3.0',
    hostname: 'mac', type: 'CURSOR_EXTENSION',
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://host.example/ui/agentic/authorize');
  assert.equal(parsed.searchParams.get('uuid'), 'U');
  assert.equal(parsed.searchParams.get('type'), 'CURSOR_EXTENSION');
  assert.equal(parsed.searchParams.get('state'), 'S');
  assert.equal(parsed.searchParams.get('port'), '5000');
  assert.equal(parsed.searchParams.get('v'), '0.3.0');
  assert.equal(parsed.searchParams.get('hostname'), 'mac');
});

function stubServer(handler: http.RequestListener): Promise<{ url: string; close: () => void }> {
  return new Promise(resolve => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as import('net').AddressInfo;
      resolve({ url: `http://127.0.0.1:${addr.port}`, close: () => srv.close() });
    });
  });
}

test('exchangeCode returns the token pair', async () => {
  const srv = await stubServer((req, res) => {
    assert.ok(req.url?.startsWith('/desktop/v1/U/tokens?code=abc'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }));
  });
  const pair = await exchangeCode(srv.url, 'U', 'abc');
  srv.close();
  assert.equal(pair?.access_token, 'AT');
  assert.equal(pair?.refresh_token, 'RT');
});

test('exchangeCode unwraps a {data:{...}} envelope', async () => {
  const srv = await stubServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: { access_token: 'AT', refresh_token: 'RT' } }));
  });
  const pair = await exchangeCode(srv.url, 'U', 'abc');
  srv.close();
  assert.equal(pair?.access_token, 'AT');
});

test('exchangeCode returns null on HTTP error', async () => {
  const srv = await stubServer((_req, res) => { res.writeHead(400); res.end('bad'); });
  const pair = await exchangeCode(srv.url, 'U', 'abc');
  srv.close();
  assert.equal(pair, null);
});

test('refreshTokens returns a new pair', async () => {
  const srv = await stubServer((req, res) => {
    assert.ok(req.url?.startsWith('/desktop/v1/U/refresh?refresh_token=RT'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ access_token: 'AT2', refresh_token: 'RT2' }));
  });
  const pair = await refreshTokens(srv.url, 'U', 'RT');
  srv.close();
  assert.equal(pair?.access_token, 'AT2');
  assert.equal(pair?.refresh_token, 'RT2');
});
