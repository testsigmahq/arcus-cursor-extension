import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cliRequest } from './http';
import { CliAuth } from './auth';
import { CmdResult } from './project';

function currentSessionId(): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.arcus', 'last_session.json'), 'utf8')) as { session_id?: string };
    return data.session_id ?? null;
  } catch {
    return null;
  }
}

export async function mapTicket(auth: CliAuth, ticketKey: string): Promise<CmdResult> {
  const sessionId = currentSessionId();
  if (!sessionId) {
    return { code: 2, out: [], err: ['arcus: no session yet — trigger any tool call first, then retry.'] };
  }
  const res = await cliRequest('POST', `${auth.apiServer.replace(/\/+$/, '')}/api/v1/plugin/map/ticket`, {
    token: auth.token,
    body: { session_id: sessionId, ticket_key: ticketKey },
  });
  if (res.status < 200 || res.status >= 300) {
    return { code: 4, out: [], err: [`arcus: map ticket failed (${res.status})`] };
  }
  const d = (res.body ?? {}) as { workflow_id?: string; provider?: string; sprint_id?: string; mapped?: boolean };
  const provider = d.provider || 'unknown provider';
  const status = d.mapped ? 'ok' : 'already-mapped';
  const sprint = d.sprint_id ? ` sprint=${d.sprint_id}` : '';
  return { code: 0, out: [`arcus: ${status} — ${provider} ticket ${ticketKey} -> workflow ${d.workflow_id ?? '(unknown)'}${sprint}`], err: [] };
}
