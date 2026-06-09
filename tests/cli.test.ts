import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { run } from '../src/cli';

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { log: (s: string) => out.push(s), error: (s: string) => err.push(s) }, out, err };
}

test('run reports auth error on err channel for project list when signed out', async () => {
  const prev = process.env.HOME;
  process.env.HOME = '/nonexistent-arcus-home-xyz';
  const c = capture();
  try {
    const code = await run(['project', 'list'], c.io);
    assert.equal(code, 1);
    assert.match(c.err.join('\n'), /arcus-login/);   // goes to err, not out
    assert.deepEqual(c.out, []);
  } finally { process.env.HOME = prev; }
});

test('run logout clears credentials and reports on out channel', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
  const prev = process.env.HOME; process.env.HOME = home;
  const dir = path.join(home, '.arcus');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), '{"auth_status":"ok"}');
  fs.writeFileSync(path.join(dir, 'refresh.token'), 'r');
  const c = capture();
  try {
    const code = await run(['logout'], c.io);
    assert.equal(code, 0);
    assert.match(c.out.join('\n'), /signed out/i);
    assert.equal(fs.existsSync(path.join(dir, 'config.json')), false);
    assert.deepEqual(c.err, []);
  } finally { process.env.HOME = prev; fs.rmSync(home, { recursive: true, force: true }); }
});

test('run rejects unknown command on err channel', async () => {
  const c = capture();
  const code = await run(['bogus'], c.io);
  assert.equal(code, 1);
  assert.match(c.err.join('\n'), /unknown command/i);
});

test('run project use pins and prints to out channel', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
  const prev = process.env.HOME; process.env.HOME = home;
  const c = capture();
  try {
    const code = await run(['project', 'use', 'proj-123'], c.io);
    assert.equal(code, 0);
    assert.match(c.out.join('\n'), /proj-123/);
    assert.deepEqual(c.err, []);
  } finally { process.env.HOME = prev; fs.rmSync(home, { recursive: true, force: true }); }
});

test('run map ticket without a key returns usage error', async () => {
  const c = capture();
  const code = await run(['map', 'ticket'], c.io);
  assert.equal(code, 1);
  assert.match(c.err.join('\n'), /usage: map ticket/);
});

test('run unknown map subcommand returns an error', async () => {
  const c = capture();
  const code = await run(['map', 'bogus'], c.io);
  assert.equal(code, 1);
  assert.notEqual(c.err.length, 0);
});
