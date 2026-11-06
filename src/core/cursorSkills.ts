import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SKILL_PREFIX = 'arcus-';

/**
 * Install the Arcus skills into ~/.cursor/skills. Each arcus-* folder is replaced as a whole, so a reference file
 * that a newer version drops does not stay behind. Folders that do not start with "arcus-" are never touched.
 */
export function writeCursorSkills(extensionPath: string): void {
  const source = path.join(extensionPath, 'skills');
  if (!fs.existsSync(source)) return;
  // Compute dir at call time so tests can override process.env.HOME before calling.
  const dir = path.join(os.homedir(), '.cursor', 'skills');
  fs.mkdirSync(dir, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(SKILL_PREFIX)) continue;
    const target = path.join(dir, entry.name);
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(path.join(source, entry.name), target, { recursive: true });
  }
}
