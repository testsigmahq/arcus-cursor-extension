import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import { LoopbackListener } from '../../src/auth/loopbackListener';

function postJson(port: number, body: unknown): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/auth-token', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode || 0 })); },
    );
    req.on('error', reject);
    req.end(data);
  });
}

test('resolves with the callback body when state matches', async () => {
  const listener = new LoopbackListener('expected-state', 2000);
  const port = await listener.start();
  const resultP = listener.waitForResult();
  const res = await postJson(port, { state: 'expected-state', code: 'the-code' });
  assert.equal(res.status, 200);
  const result = await resultP;
  assert.equal(result?.code, 'the-code');
  listener.stop();
});

test('rejects a state mismatch with 400 and keeps waiting (times out to null)', async () => {
  const listener = new LoopbackListener('expected-state', 300);
  const port = await listener.start();
  const resultP = listener.waitForResult();
  const res = await postJson(port, { state: 'wrong', code: 'x' });
  assert.equal(res.status, 400);
  const result = await resultP;
  assert.equal(result, null);
  listener.stop();
});

test('times out to null when no callback arrives', async () => {
  const listener = new LoopbackListener('s', 200);
  await listener.start();
  const result = await listener.waitForResult();
  assert.equal(result, null);
  listener.stop();
});
