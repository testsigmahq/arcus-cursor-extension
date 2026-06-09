import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readPinnedProject, writePinnedProject } from '../../src/cli/projectStore';

test('round-trips the pinned project id', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
  const prev = process.env.HOME;
  process.env.HOME = home;
  try {
    assert.equal(readPinnedProject(), null);
    writePinnedProject('proj-42');
    assert.equal(readPinnedProject(), 'proj-42');
  } finally {
    process.env.HOME = prev;
    fs.rmSync(home, { recursive: true, force: true });
  }
});
