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
      `Arcus captures your Cursor session context into Testsigma.\n\n` +
      `- \`/arcus-login\` — sign in\n- \`/arcus-logout\` — sign out\n` +
      `- \`/arcus-project list [search]\` — list projects\n- \`/arcus-project use <id>\` — pin a project\n` +
      `- \`/arcus-project current\` — show pinned project\n- \`/arcus-map ticket <KEY>\` — map a ticket\n`,
  };

  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body, 'utf8');
  }
}
