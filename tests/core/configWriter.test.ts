import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeCursorCommands } from '../../src/core/cursorCommands';

test('writeCursorCommands writes all command files with the bundled cli path', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
  const prev = process.env.HOME; process.env.HOME = home;
  try {
    writeCursorCommands('/opt/ext');
    const dir = path.join(home, '.cursor', 'commands');
    const names = fs.readdirSync(dir).sort();
    assert.deepEqual(names, ['arcus-help.md', 'arcus-login.md', 'arcus-logout.md', 'arcus-map.md', 'arcus-project.md']);
    assert.match(fs.readFileSync(path.join(dir, 'arcus-login.md'), 'utf8'), /node "\/opt\/ext\/dist\/cli\.js" login/);
    assert.match(fs.readFileSync(path.join(dir, 'arcus-logout.md'), 'utf8'), /node "\/opt\/ext\/dist\/cli\.js" logout/);
    assert.match(fs.readFileSync(path.join(dir, 'arcus-project.md'), 'utf8'), /node "\/opt\/ext\/dist\/cli\.js" project/);
    assert.match(fs.readFileSync(path.join(dir, 'arcus-map.md'), 'utf8'), /node "\/opt\/ext\/dist\/cli\.js" map ticket/);
  } finally { process.env.HOME = prev; fs.rmSync(home, { recursive: true, force: true }); }
});
