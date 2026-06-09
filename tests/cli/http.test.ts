import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { cliRequest } from '../../src/cli/http';

function serve(handler: http.RequestListener): Promise<{ url: string; close: () => void; received: () => unknown }> {
  return new Promise(resolve => {
    let received: unknown = null;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        received = { method: req.method, url: req.url, token: req.headers['x-agentic-token'], body: body || null };
        handler(req, res);
      });
    });
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close(), received: () => received });
    });
  });
}

test('cliRequest sends x-agentic-token and parses JSON', async () => {
  const s = await serve((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true })); });
  const r = await cliRequest('GET', `${s.url}/x`, { token: 'tok-1' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal((s.received() as { token: string }).token, 'tok-1');
  s.close();
});

test('cliRequest sends a JSON body on POST', async () => {
  const s = await serve((_req, res) => { res.writeHead(201); res.end('{}'); });
  const r = await cliRequest('POST', `${s.url}/y`, { token: 't', body: { a: 1 } });
  assert.equal(r.status, 201);
  assert.equal((s.received() as { method: string }).method, 'POST');
  assert.deepEqual(JSON.parse((s.received() as { body: string }).body), { a: 1 });
  s.close();
});

test('cliRequest rejects on timeout', async () => {
  const server = http.createServer((_req, res) => { setTimeout(() => { res.writeHead(200); res.end('{}'); }, 500); });
  await new Promise<void>(r => server.listen(0, r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/slow`;
  await assert.rejects(() => cliRequest('GET', url, { token: 't', timeoutMs: 50 }), /timeout/i);
  server.close();
});
