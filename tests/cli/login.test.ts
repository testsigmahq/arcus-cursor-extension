import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import { cliLogin, cliLogout } from '../../src/cli/login';

function withHome(fn: (home: string) => Promise<void>) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    try { await fn(home); } finally { process.env.HOME = prev; fs.rmSync(home, { recursive: true, force: true }); }
  };
}

/** A token server standing in for the SSO backend's token-exchange endpoint. */
function tokenServer(pair: unknown): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(pair));
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>(r => server.close(() => r())),
      });
    });
  });
}

/** Make a JWT-shaped access token whose payload carries the given claims. */
function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}

/** Drive the real loopback listener as the browser would: POST the callback. */
function postCallback(authorizeUrl: string): void {
  const u = new URL(authorizeUrl);
  const port = u.searchParams.get('port');
  const state = u.searchParams.get('state');
  const body = JSON.stringify({ state, code: 'auth-code-123' });
  const req = http.request({
    hostname: '127.0.0.1', port: Number(port), path: '/auth-token', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.end(body);
}

test('cliLogin runs the SSO flow and writes the shared store', withHome(async home => {
  const token = jwt({ account_id: 'acc-1', user_id: 'usr-1', email: 'dev@example.com' });
  const srv = await tokenServer({ access_token: token, refresh_token: 'refresh-1', expires_in: 3600 });
  try {
    const out: string[] = []; const err: string[] = [];
    const res = await cliLogin({
      authServer: srv.url,
      apiServer: 'http://api.local',
      version: '9.9.9',
      hostname: 'test-host',
      openUrl: postCallback,
    });
    res.out.forEach(s => out.push(s)); res.err.forEach(s => err.push(s));

    assert.equal(res.code, 0);
    assert.match(res.out.join('\n'), /dev@example\.com/);

    const cfg = JSON.parse(fs.readFileSync(path.join(home, '.arcus', 'config.json'), 'utf8'));
    assert.equal(cfg.auth_status, 'ok');
    assert.equal(cfg.account_id, 'acc-1');
    assert.equal(cfg.user_id, 'usr-1');
    assert.equal(cfg.user_email, 'dev@example.com');
    assert.equal(cfg.api_server, 'http://api.local');
    assert.equal(cfg.auth_server, srv.url);
    assert.equal(cfg.access_token, token);
    assert.equal(fs.readFileSync(path.join(home, '.arcus', 'refresh.token'), 'utf8'), 'refresh-1');
  } finally { await srv.close(); }
}));

test('cliLogin reports a timeout instead of hanging', withHome(async () => {
  const res = await cliLogin({
    authServer: 'http://unused.local',
    apiServer: 'http://api.local',
    version: '1.0.0',
    hostname: 'h',
    openUrl: () => { /* browser never returns */ },
    timeoutMs: 50,
  });
  assert.equal(res.code, 1);
  assert.match(res.err.join('\n'), /timed out/i);
}));

test('cliLogin fails when the token lacks account_id / user_id', withHome(async () => {
  const srv = await tokenServer({ access_token: jwt({ email: 'x@y.z' }), refresh_token: 'r', expires_in: 60 });
  try {
    const res = await cliLogin({
      authServer: srv.url, apiServer: 'http://api.local', version: '1', hostname: 'h',
      openUrl: postCallback,
    });
    assert.equal(res.code, 1);
    assert.match(res.err.join('\n'), /account_id|user_id/);
  } finally { await srv.close(); }
}));

test('cliLogout clears the shared store', withHome(async home => {
  const dir = path.join(home, '.arcus');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ auth_status: 'ok' }));
  fs.writeFileSync(path.join(dir, 'refresh.token'), 'r');
  fs.writeFileSync(path.join(dir, 'config'), 'ARCUS_ACCESS_TOKEN=x\n');

  const res = cliLogout();
  assert.equal(res.code, 0);
  assert.equal(fs.existsSync(path.join(dir, 'config.json')), false);
  assert.equal(fs.existsSync(path.join(dir, 'refresh.token')), false);
  assert.equal(fs.existsSync(path.join(dir, 'config')), false);
}));
