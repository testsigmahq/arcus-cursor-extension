import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writeCursorSkills } from '../../src/core/cursorSkills';
import { writeCursorCommands } from '../../src/core/cursorCommands';

const repoRoot = path.join(__dirname, '..', '..');
const SKILLS = ['arcus-author', 'arcus-push', 'arcus-run', 'arcus-setup'];

function withHome<T>(fn: (home: string) => T): T {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arcus-home-'));
  const prev = process.env.HOME;
  process.env.HOME = home;
  try {
    return fn(home);
  } finally {
    process.env.HOME = prev;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('the packaged skills are the four Arcus skills, each named after its folder', () => {
  assert.deepEqual(fs.readdirSync(path.join(repoRoot, 'skills')).sort(), SKILLS);
  for (const name of SKILLS) {
    const text = fs.readFileSync(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert.match(text, new RegExp(`^---\\nname: ${name}\\ndescription: Use when `));
  }
});

test('no packaged skill keeps a Claude-only phrase, and every reference it names exists', () => {
  for (const name of SKILLS) {
    const dir = path.join(repoRoot, 'skills', name);
    const files = [path.join(dir, 'SKILL.md')];
    const refs = path.join(dir, 'references');
    if (fs.existsSync(refs)) for (const f of fs.readdirSync(refs)) files.push(path.join(refs, f));
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /Claude|CLAUDE_|\/arcus:|! arcus|Bash tool|Read tool/, file);
      for (const m of text.matchAll(/references\/([a-z-]+\.md)/g)) {
        assert.ok(fs.existsSync(path.join(dir, 'references', m[1])), `${file} names missing ${m[1]}`);
      }
    }
  }
});

test('the setup skill tells the user about the separate extension sign-in', () => {
  const text = fs.readFileSync(path.join(repoRoot, 'skills', 'arcus-setup', 'SKILL.md'), 'utf8');
  assert.match(text, /## In Cursor/);
  assert.match(text, /Arcus: Sign In/);
});

test('writeCursorSkills installs every skill with its references', () => {
  withHome((home) => {
    writeCursorSkills(repoRoot);
    const dir = path.join(home, '.cursor', 'skills');
    assert.deepEqual(fs.readdirSync(dir).sort(), SKILLS);
    assert.ok(fs.existsSync(path.join(dir, 'arcus-run', 'references', 'running.md')));
    assert.ok(fs.existsSync(path.join(dir, 'arcus-author', 'references', 'editing.md')));
  });
});

test('writeCursorSkills replaces an Arcus skill whole and leaves other skills alone', () => {
  withHome((home) => {
    const dir = path.join(home, '.cursor', 'skills');
    fs.mkdirSync(path.join(dir, 'arcus-run', 'references'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'arcus-run', 'references', 'dropped.md'), 'old');
    fs.mkdirSync(path.join(dir, 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'my-skill', 'SKILL.md'), 'mine');

    writeCursorSkills(repoRoot);

    assert.ok(!fs.existsSync(path.join(dir, 'arcus-run', 'references', 'dropped.md')));
    assert.equal(fs.readFileSync(path.join(dir, 'my-skill', 'SKILL.md'), 'utf8'), 'mine');
  });
});

test('writeCursorCommands removes the old test and push commands, but only if they are still ours', () => {
  withHome((home) => {
    const dir = path.join(home, '.cursor', 'commands');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'arcus-test.md'), 'run `testsigma code validate --input x`');
    fs.writeFileSync(path.join(dir, 'arcus-push.md'), 'my own notes about pushing');

    writeCursorCommands('/opt/ext');

    assert.ok(!fs.existsSync(path.join(dir, 'arcus-test.md')));
    assert.equal(fs.readFileSync(path.join(dir, 'arcus-push.md'), 'utf8'), 'my own notes about pushing');
  });
});

test('the help command lists the four skills and the session commands', () => {
  withHome((home) => {
    writeCursorCommands('/opt/ext');
    const help = fs.readFileSync(path.join(home, '.cursor', 'commands', 'arcus-help.md'), 'utf8');
    for (const name of ['arcus-setup', 'arcus-author', 'arcus-run', 'arcus-push', 'arcus-map', 'arcus-project']) {
      assert.ok(help.includes(`/${name}`), name);
    }
  });
});
