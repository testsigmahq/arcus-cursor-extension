import { loadCliAuth } from './cli/auth';
import { projectList, projectUse, projectCurrent, CmdResult } from './cli/project';
import { mapTicket } from './cli/map';
import { loginCommand, cliLogout } from './cli/login';

export interface Io { log: (s: string) => void; error: (s: string) => void }

const NEED_LOGIN = 'arcus: not authenticated. Run /arcus-login first.';

async function dispatch(argv: string[], io: Io): Promise<CmdResult> {
  const [cmd, sub, ...rest] = argv;

  if (cmd === 'login') return loginCommand(io);
  if (cmd === 'logout') return cliLogout();

  if (cmd === 'project') {
    if (sub === 'current') return projectCurrent();
    if (sub === 'use') {
      if (!rest[0]) return { code: 1, out: [], err: ['usage: project use <project_id>'] };
      return projectUse(rest[0]);
    }
    if (sub === 'list') {
      const auth = await loadCliAuth();
      if (!auth) return { code: 1, out: [], err: [NEED_LOGIN] };
      return projectList(auth, rest[0]);
    }
    return { code: 1, out: [], err: ['usage: project <list|use|current>'] };
  }

  if (cmd === 'map') {
    if (sub === 'ticket') {
      if (!rest[0]) return { code: 1, out: [], err: ['usage: map ticket <KEY>'] };
      const auth = await loadCliAuth();
      if (!auth) return { code: 1, out: [], err: [NEED_LOGIN] };
      return mapTicket(auth, rest[0]);
    }
    return { code: 1, out: [], err: ['usage: map ticket <KEY>'] };
  }

  return { code: 1, out: [], err: [`arcus: unknown command "${cmd ?? ''}"`] };
}

export async function run(argv: string[], io: Io): Promise<number> {
  const r = await dispatch(argv, io);
  r.out.forEach(io.log);
  r.err.forEach(io.error);
  return r.code;
}

// Entry guard: true when invoked as `node dist/cli.js`. esbuild bundles cli.ts
// as a single CJS entry (Task 8), where the entry module IS require.main, so this
// holds for the bundle too; Task 8's `node dist/cli.js` smoke test verifies it.
if (require.main === module) {
  run(process.argv.slice(2), { log: s => console.log(s), error: s => console.error(s) })
    .then(code => process.exit(code))
    .catch(err => { console.error(`arcus: ${err?.message || err}`); process.exit(1); });
}
