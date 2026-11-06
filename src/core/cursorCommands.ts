import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Provision the arcus Cursor slash commands. */
export function writeCursorCommands(extensionPath: string): void {
  const cli = path.join(extensionPath, 'dist', 'cli.js');
  // Compute dir at call time so tests can override process.env.HOME before calling.
  const dir = path.join(os.homedir(), '.cursor', 'commands');

  const files: Record<string, string> = {
    'arcus-login.md':
      `---\ndescription: Sign in to Arcus (Testsigma SSO)\n---\n\n` +
      `Start the Arcus sign-in flow. Run exactly this in the terminal:\n\n` +
      `\`\`\`bash\nnode "${cli}" login\n\`\`\`\n\n` +
      `This opens a browser tab for Testsigma SSO and waits for you to authenticate (up to 5 min). ` +
      `On success the credentials are saved to the shared Arcus store (~/.arcus) and the extension adopts them automatically.\n`,
    'arcus-logout.md':
      `---\ndescription: Sign out of Arcus\n---\n\n` +
      `Clear Arcus credentials. Run exactly this in the terminal:\n\n` +
      `\`\`\`bash\nnode "${cli}" logout\n\`\`\`\n`,
    'arcus-project.md':
      `---\ndescription: List Testsigma projects and pin the active project\n---\n\n` +
      `Subcommands: \`list [search]\`, \`use <project_id>\`, \`current\`.\n\n` +
      `Run the Arcus CLI in the terminal, substituting the user's arguments for <args>:\n\n` +
      `\`\`\`bash\nnode "${cli}" project <args>\n\`\`\`\n`,
    'arcus-map.md':
      `---\ndescription: Map a ticket to the current session's workflow\n---\n\n` +
      `Before mapping, confirm a project is pinned (\`node "${cli}" project current\`); if none, tell the user to run \`/arcus-project use <id>\` first. ` +
      `Show the user the pinned project and the ticket key and get explicit confirmation, then run:\n\n` +
      `\`\`\`bash\nnode "${cli}" map ticket <KEY>\n\`\`\`\n`,
    'arcus-help.md':
      `---\ndescription: Show Arcus commands\n---\n\n` +
      `Arcus captures your Cursor session context into Testsigma, and helps you write, run and push Arcus tests.\n\n` +
      `Tests (these use the \`arcus\` CLI; type the name in the agent chat):\n` +
      `- \`/arcus-setup\` — check the CLI, your sign-in, the project, and whether this computer can run tests\n` +
      `- \`/arcus-author [what to cover]\` — write a test as a .sigma file and check it\n` +
      `- \`/arcus-run [test]\` — run one web test in a browser on this computer and read the result\n` +
      `- \`/arcus-push [files]\` — show what a push would do, then push after your yes\n\n` +
      `Session capture:\n` +
      `- \`/arcus-login\` — sign in\n- \`/arcus-logout\` — sign out\n` +
      `- \`/arcus-project list [search]\` — list projects\n- \`/arcus-project use <id>\` — pin a project\n` +
      `- \`/arcus-project current\` — show pinned project\n- \`/arcus-map ticket <KEY>\` — map a ticket\n`,
  };

  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body, 'utf8');
  }
  removeObsoleteCommands(dir);
}

/**
 * Versions before 1.1 wrote /arcus-test and /arcus-push, which drive the old `testsigma` CLI. Skills replace them.
 * A file is removed only if it is still the text this extension wrote: a file the user edited is left alone.
 */
const OBSOLETE: Record<string, RegExp> = {
  'arcus-test.md': /testsigma code (validate|run)/,
  'arcus-push.md': /testsigma code push/,
};

function removeObsoleteCommands(dir: string): void {
  for (const [name, marker] of Object.entries(OBSOLETE)) {
    const file = path.join(dir, name);
    try {
      if (marker.test(fs.readFileSync(file, 'utf8'))) fs.unlinkSync(file);
    } catch {
      /* not there */
    }
  }
}
