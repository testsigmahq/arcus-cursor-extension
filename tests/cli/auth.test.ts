import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import { loadCliAuth } from '../../src/cli/auth';

function withHome(fn: (home: string) => Promise<void>) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
    const prev = process.env.HOME;
    process.env.HOME = home;
    try { await fn(home); } finally { process.env.HOME = prev; fs.rmSync(home, { recursive: true, force: true }); }
  };
}

function writeStore(home: string, cfg: Record<string, unknown>, refresh = 'r') {
  const dir = path.join(home, '.arcus');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg));
  fs.writeFileSync(path.join(dir, 'refresh.token'), refresh);
}

test('loadCliAuth returns null when not signed in', withHome(async () => {
  assert.equal(await loadCliAuth(), null);
}));

test('loadCliAuth returns a still-valid cached token', withHome(async home => {
  writeStore(home, {
    schema_version: 1, api_server: 'http://api', auth_server: 'http://auth', uuid: 'u',
    account_id: 'a', user_id: 'usr', user_email: 'e', access_token: 'valid',
    access_expires_at: '2999-01-01T00:00:00Z', expires_at: '2999-01-01T00:00:00Z', auth_status: 'ok',
  });
  const a = await loadCliAuth();
  assert.deepEqual(a, { apiServer: 'http://api', token: 'valid' });
}));

test('loadCliAuth refreshes an expired token and writes it back', withHome(async home => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ access_token: 'fresh', refresh_token: 'r2', expires_in: 3600 }));
  });
  await new Promise<void>(r => server.listen(0, r));
  const authUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  writeStore(home, {
    schema_version: 1, api_server: 'http://api', auth_server: authUrl, uuid: 'u',
    account_id: 'a', user_id: 'usr', user_email: 'e', access_token: 'stale',
    access_expires_at: '2000-01-01T00:00:00Z', expires_at: '2000-01-01T00:00:00Z', auth_status: 'ok',
  });
  const a = await loadCliAuth();
  assert.deepEqual(a, { apiServer: 'http://api', token: 'fresh' });
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.arcus', 'config.json'), 'utf8'));
  assert.equal(cfg.access_token, 'fresh');
  assert.equal(fs.readFileSync(path.join(home, '.arcus', 'refresh.token'), 'utf8'), 'r2');
  await new Promise<void>(r => server.close(() => r()));
}));

test('loadCliAuth returns null and marks expired when refresh returns empty access_token', withHome(async home => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ access_token: '', refresh_token: 'r2', expires_in: 3600 }));
  });
  await new Promise<void>(r => server.listen(0, r));
  const authUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  writeStore(home, {
    schema_version: 1, api_server: 'http://api', auth_server: authUrl, uuid: 'u',
    account_id: 'a', user_id: 'usr', user_email: 'e', access_token: 'stale',
    access_expires_at: '2000-01-01T00:00:00Z', expires_at: '2000-01-01T00:00:00Z', auth_status: 'ok',
  });
  const a = await loadCliAuth();
  assert.equal(a, null);
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.arcus', 'config.json'), 'utf8'));
  assert.equal(cfg.auth_status, 'expired');
  assert.ok(!cfg.access_token, 'access_token should be cleared');
  await new Promise<void>(r => server.close(() => r()));
}));
