import { cliRequest } from './http';
import { CliAuth } from './auth';
import { readPinnedProject, writePinnedProject } from './projectStore';

export interface CmdResult { code: number; out: string[]; err: string[] }

interface ProjectRow { id: string; human_id_prefix?: string; name?: string }

export async function projectList(auth: CliAuth, search: string | undefined): Promise<CmdResult> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await cliRequest('GET', `${auth.apiServer.replace(/\/+$/, '')}/api/v1/plugin/projects${qs}`, { token: auth.token });
  if (res.status < 200 || res.status >= 300) {
    return { code: 2, out: [], err: [`arcus: list projects failed (${res.status})`] };
  }
  const projects = ((res.body as { projects?: ProjectRow[] })?.projects) ?? [];
  if (projects.length === 0) return { code: 0, out: ['(no projects)'], err: [] };
  const width = Math.max(1, ...projects.map(p => (p.human_id_prefix || '').length));
  const out = projects.map(p => `${p.id}  ${(p.human_id_prefix || '').padEnd(width)}  ${p.name || ''}`);
  return { code: 0, out, err: [] };
}

export function projectUse(projectId: string): CmdResult {
  writePinnedProject(projectId);
  return { code: 0, out: [`arcus: pinned project_id=${projectId}`], err: [] };
}

export function projectCurrent(): CmdResult {
  const pid = readPinnedProject();
  if (pid) return { code: 0, out: [pid], err: [] };
  return { code: 0, out: ['(no project pinned; run /arcus-project use <id>)'], err: [] };
}
