import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SharedStoreWatcher } from '../../src/auth/sharedStoreWatcher';

interface Spy { signIn: number; signOut: number }

function makeHooks(state: { signedIn: boolean; sharedCreds: boolean }, spy: Spy) {
  return {
    isSignedIn: () => state.signedIn,
    hasSharedCreds: () => state.sharedCreds,
    onSignIn: async () => { spy.signIn++; state.signedIn = true; },
    onSignOut: async () => { spy.signOut++; state.signedIn = false; },
  };
}

test('reconcile adopts a sign-in performed elsewhere (creds appear while signed out)', async () => {
  const spy: Spy = { signIn: 0, signOut: 0 };
  const state = { signedIn: false, sharedCreds: true };
  const w = new SharedStoreWatcher(makeHooks(state, spy));
  await w.reconcile();
  assert.equal(spy.signIn, 1);
  assert.equal(spy.signOut, 0);
});

test('reconcile tears down the live session when creds disappear (logout elsewhere)', async () => {
  const spy: Spy = { signIn: 0, signOut: 0 };
  const state = { signedIn: true, sharedCreds: false };
  const w = new SharedStoreWatcher(makeHooks(state, spy));
  await w.reconcile();
  assert.equal(spy.signOut, 1);
  assert.equal(spy.signIn, 0);
});

test('reconcile is a no-op when live state already matches the shared store', async () => {
  const spy: Spy = { signIn: 0, signOut: 0 };
  // signed in + creds present
  await new SharedStoreWatcher(makeHooks({ signedIn: true, sharedCreds: true }, spy)).reconcile();
  // signed out + no creds
  await new SharedStoreWatcher(makeHooks({ signedIn: false, sharedCreds: false }, spy)).reconcile();
  assert.equal(spy.signIn, 0);
  assert.equal(spy.signOut, 0);
});

test('start() reconciles immediately for changes made while the watcher was down', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-watch-'));
  const dir = path.join(home, '.arcus');
  const spy: Spy = { signIn: 0, signOut: 0 };
  const state = { signedIn: false, sharedCreds: true };
  const w = new SharedStoreWatcher(makeHooks(state, spy));
  try {
    w.start(dir);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(spy.signIn, 1);
  } finally { w.stop(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('start() reacts to a file change by reconciling', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-watch-'));
  const dir = path.join(home, '.arcus');
  fs.mkdirSync(dir, { recursive: true });
  const spy: Spy = { signIn: 0, signOut: 0 };
  // Start signed-out with no creds; then "log in" by writing config.json.
  const state = { signedIn: false, sharedCreds: false };
  const w = new SharedStoreWatcher(makeHooks(state, spy), 10);
  try {
    w.start(dir);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(spy.signIn, 0, 'no sign-in before creds exist');

    state.sharedCreds = true;
    fs.writeFileSync(path.join(dir, 'config.json'), '{}');
    await new Promise(r => setTimeout(r, 150));
    assert.equal(spy.signIn, 1, 'sign-in adopted after creds written');
  } finally { w.stop(); fs.rmSync(home, { recursive: true, force: true }); }
});
