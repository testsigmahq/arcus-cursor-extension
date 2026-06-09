import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function storePath(): string {
  return path.join(os.homedir(), '.arcus', 'project.json');
}

export function readPinnedProject(): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), 'utf8')) as { project_id?: string };
    return data.project_id ?? null;
  } catch {
    return null;
  }
}

export function writePinnedProject(projectId: string): void {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify({ project_id: projectId }, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, p);
}
