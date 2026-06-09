import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { updateSharedTokens } from '../../src/auth/sharedConfig';

test('updateSharedTokens patches tokens, preserves other fields', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
  const prev = process.env.HOME;
  process.env.HOME = home;
  try {
    const dir = path.join(home, '.arcus');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
      schema_version: 1, api_server: 'http://api', auth_server: 'http://auth',
      uuid: 'u', account_id: 'a', user_id: 'usr', user_email: 'e@x.com',
      access_token: 'old', access_expires_at: '2020-01-01T00:00:00Z',
      expires_at: '2020-01-01T00:00:00Z', auth_status: 'ok',
    }));
    fs.writeFileSync(path.join(dir, 'refresh.token'), 'old-refresh');

    updateSharedTokens({ accessToken: 'new', refreshToken: 'new-refresh', expiresAt: '2030-01-01T00:00:00Z' });

    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    assert.equal(cfg.access_token, 'new');
    assert.equal(cfg.access_expires_at, '2030-01-01T00:00:00Z');
    assert.equal(cfg.expires_at, '2030-01-01T00:00:00Z');
    assert.equal(cfg.account_id, 'a');           // preserved
    assert.equal(cfg.auth_status, 'ok');
    assert.equal(fs.readFileSync(path.join(dir, 'refresh.token'), 'utf8'), 'new-refresh');
  } finally {
    process.env.HOME = prev;
    fs.rmSync(home, { recursive: true, force: true });
  }
});
