import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import { projectList, projectCurrent, projectUse } from '../../src/cli/project';

function serve(payload: unknown, status = 200): Promise<{ apiServer: string; close: () => void; lastPath: () => string }> {
  return new Promise(resolve => {
    let lastPath = '';
    const server = http.createServer((req, res) => {
      lastPath = req.url || '';
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
    server.listen(0, () => resolve({
      apiServer: `http://127.0.0.1:${(server.address() as any).port}`,
      close: () => server.close(),
      lastPath: () => lastPath,
    }));
  });
}

test('projectList prints id/prefix/name and hits the search query', async () => {
  const s = await serve({ projects: [{ id: '1', human_id_prefix: 'AB', name: 'Alpha' }] });
  const r = await projectList({ apiServer: s.apiServer, token: 't' }, 'al');
  assert.equal(r.code, 0);
  assert.match(r.out.join('\n'), /1\s+AB\s+Alpha/);
  assert.match(s.lastPath(), /\/api\/v1\/plugin\/projects\?search=al/);
  s.close();
});

test('projectList handles empty list', async () => {
  const s = await serve({ projects: [] });
  const r = await projectList({ apiServer: s.apiServer, token: 't' }, undefined);
  assert.equal(r.code, 0);
  assert.deepEqual(r.out, ['(no projects)']);
  s.close();
});

test('projectUse pins and projectCurrent reads it back', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
  const prev = process.env.HOME; process.env.HOME = home;
  try {
    const u = projectUse('p-9');
    assert.equal(u.code, 0);
    assert.match(u.out.join('\n'), /p-9/);
    const c = projectCurrent();
    assert.deepEqual(c.out, ['p-9']);
  } finally { process.env.HOME = prev; fs.rmSync(home, { recursive: true, force: true }); }
});

test('projectList returns code 2 on non-2xx', async () => {
  const s = await serve({ error: 'nope' }, 500);
  const r = await projectList({ apiServer: s.apiServer, token: 't' }, undefined);
  assert.equal(r.code, 2);
  assert.match(r.err.join('\n'), /failed \(500\)/);
  s.close();
});

test('projectCurrent reports when nothing is pinned', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
  const prev = process.env.HOME; process.env.HOME = home;
  try {
    const c = projectCurrent();
    assert.match(c.out.join('\n'), /no project pinned/);
  } finally { process.env.HOME = prev; fs.rmSync(home, { recursive: true, force: true }); }
});
