import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import { mapTicket } from '../../src/cli/map';

function withHome(fn: (home: string) => Promise<void>) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
    const prev = process.env.HOME; process.env.HOME = home;
    try { await fn(home); } finally { process.env.HOME = prev; fs.rmSync(home, { recursive: true, force: true }); }
  };
}

test('mapTicket errors when there is no session yet', withHome(async () => {
  const r = await mapTicket({ apiServer: 'http://api', token: 't' }, 'JIRA-1');
  assert.equal(r.code, 2);
  assert.match(r.err.join('\n'), /no session/i);
}));

test('mapTicket posts session_id + ticket_key and reports success', withHome(async home => {
  let body = '';
  const server = http.createServer((req, res) => {
    req.on('data', c => (body += c));
    req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ workflow_id: 'wf-7', provider: 'jira', sprint_id: 's-3', mapped: true })); });
  });
  await new Promise<void>(r => server.listen(0, r));
  const apiServer = `http://127.0.0.1:${(server.address() as any).port}`;
  fs.mkdirSync(path.join(home, '.arcus'), { recursive: true });
  fs.writeFileSync(path.join(home, '.arcus', 'last_session.json'), JSON.stringify({ session_id: 'sess-1', cwd: '/x', ts: 1 }));

  const r = await mapTicket({ apiServer, token: 't' }, 'JIRA-9');
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(body), { session_id: 'sess-1', ticket_key: 'JIRA-9' });
  assert.match(r.out.join('\n'), /jira ticket JIRA-9 -> workflow wf-7/);
  assert.match(r.out.join('\n'), /sprint=s-3/);
  await new Promise<void>(r => server.close(() => r()));
}));

test('mapTicket returns code 4 when server responds non-2xx', withHome(async home => {
  const server = http.createServer((_req, res) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal server error' }));
  });
  await new Promise<void>(r => server.listen(0, r));
  const apiServer = `http://127.0.0.1:${(server.address() as any).port}`;
  fs.mkdirSync(path.join(home, '.arcus'), { recursive: true });
  fs.writeFileSync(path.join(home, '.arcus', 'last_session.json'), JSON.stringify({ session_id: 'sess-2', cwd: '/x', ts: 1 }));

  const r = await mapTicket({ apiServer, token: 't' }, 'JIRA-2');
  assert.equal(r.code, 4);
  assert.match(r.err.join('\n'), /map ticket failed \(500\)/);
  await new Promise<void>(r => server.close(() => r()));
}));

test('mapTicket formats already-mapped without sprint suffix', withHome(async home => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ workflow_id: 'wf-1', provider: 'github', mapped: false }));
  });
  await new Promise<void>(r => server.listen(0, r));
  const apiServer = `http://127.0.0.1:${(server.address() as any).port}`;
  fs.mkdirSync(path.join(home, '.arcus'), { recursive: true });
  fs.writeFileSync(path.join(home, '.arcus', 'last_session.json'), JSON.stringify({ session_id: 'sess-3', cwd: '/x', ts: 1 }));

  const r = await mapTicket({ apiServer, token: 't' }, 'GH-5');
  assert.equal(r.code, 0);
  assert.match(r.out.join('\n'), /already-mapped — github ticket .* -> workflow wf-1/);
  assert.doesNotMatch(r.out.join('\n'), /sprint=/);
  await new Promise<void>(r => server.close(() => r()));
}));
