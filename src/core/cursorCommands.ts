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
    'arcus-test.md':
      `---
description: Author Testsigma script e2e tests for this repo, validate them, and offer to run them
---

Author end-to-end tests for the current repository in **Testsigma script** (the
code-v2 TypeScript DSL) and verify them with the \`testsigma\` CLI. Authoring is
offline and safe; running reaches a live target and is always gated behind
explicit confirmation. If the user named a feature/area, scope the tests to it;
otherwise ask what to cover.

## Preflight — the CLI must be installed

Run \`testsigma --version\` (or \`command -v testsigma\`). If \`testsigma\` is not on
\`PATH\`, STOP and tell the developer to install/configure the testsigma CLI — do
not author from memory. The CLI is the source of truth for the DSL.

## Step 1 — Detect the application type

Inspect the repo and pick the first confident match:

- **mobile** — \`android/\`, \`ios/\`, \`*.xcodeproj\`, \`pubspec.yaml\`, \`react-native\`
  in \`package.json\`, or Capacitor/Ionic.
- **web** — a web framework in \`package.json\` (React/Vue/Svelte/Next/Angular)
  without the mobile signals above.
- **api** — OpenAPI/Swagger files, or a backend framework
  (Express/Fastify/Spring/FastAPI/Rails) with no UI.

If signals conflict or none match, ASK whether it's \`web\`, \`mobile\`, or \`api\`.
Never guess.

## Step 2 — Load the DSL reference from the CLI

For the detected type \`<t>\`:

\`\`\`bash
testsigma code reference --type <t>
testsigma code examples --type <t>
\`\`\`

Read both. Author strictly within what they show — do not invent method names.

## Step 3 — Author the spec(s)

- Read the relevant application source for selectors / routes / endpoints.
- Choose the test directory: default \`tests/testsigma/\`. If the repo already has a
  tests convention (\`e2e/\`, \`__tests__/\`, \`cypress/\`), nest under it.
- Write \`tests/<e2e-dir>/<feature>.spec.ts\` — one spec per feature: \`element()\`
  declarations at the top, a focused \`test(...)\`, \`expect(...)\` assertions, and
  \`reusable(...)\` where steps repeat.

## Step 4 — Validate offline (always)

\`\`\`bash
testsigma code validate --input tests/<e2e-dir>/<feature>.spec.ts
\`\`\`

If it reports diagnostics, fix the spec and re-validate until clean.

## Step 5 — Offer to run (resolve the target first, then confirm)

\`testsigma code run\` reaches a **live target**. Resolve what it needs BEFORE
calling it, tell the developer exactly what you'll use, and run only on an explicit
"yes". **Never call \`code run\` with empty or placeholder caps.**

- **web** — a base URL (running dev server or deployed site). Offer to detect a
  local dev-server port, then \`testsigma code run --input tests/<e2e-dir>/<feature>.spec.ts\`.
- **api** — the API base URL and any required env, then the same \`code run\`.
- **mobile** — needs a connected device AND the app installed on it. List devices
  with \`testsigma list devices --local\`; resolve adb
  (\`command -v adb || echo "$HOME/.testsigma/android/platform-tools/adb"\`); read the
  app package from the repo (\`applicationId\` / \`AndroidManifest.xml\`); verify it's
  installed (\`adb -s <id> shell pm list packages\`); resolve the launch activity
  (\`adb -s <id> shell cmd package resolve-activity --brief <pkg>\`); then run with
  \`--device <id> --caps '{"appium:appPackage":"<pkg>","appium:appActivity":"<activity>","appium:noReset":false}'\`.
  (iOS: use \`appium:bundleId\`; no \`appActivity\`.) If any step can't be satisfied,
  STOP and say what to fix.

Whatever the type, ask **"To run this I need <X>. Run it now?"** and only run on yes.

## Step 6 — Read the results

\`code run\` prints a single JSON summary line and writes full per-step results to a
temp file (\`resultsFile\`). \`overall\` + a non-zero exit code give the outcome. On
failure, read \`resultsFile\` (JSONL) and report the failing step (\`description\`,
\`errorType\`, \`message\`, \`locator\`), then offer to iterate.
`,
    'arcus-push.md':
      `---
description: Push the Testsigma-script test cases you authored this session to Agentic Test
---

Push the Testsigma-script test cases authored this session — the \`*.spec.ts\` files
written or edited under \`tests/\` — into Agentic Test. Authentication, session
detection, compilation, and the Agentic Test calls all happen in the \`testsigma\`
CLI; this command only helps you gather the target and metadata it needs.

## Required pre-flight (do NOT skip)

Confirm a project is pinned:

\`\`\`bash
node "${cli}" project current
\`\`\`

If none is pinned, ABORT and tell the user to run \`/arcus-project use <id>\` first.
Otherwise capture the printed project id as \`<project_id>\`.

## Choose a target

List the project's sprints:

\`\`\`bash
testsigma sprints list --project-id <project_id>
\`\`\`

If this fails with an auth error, tell the user to run \`testsigma login\` (the CLI
uses its own login, separate from \`/arcus-login\`). Show the sprints
(\`WORK_CYCLE_ID\` + \`TITLE\`) and also offer an **"unmapped"** option; ask the user
to pick exactly one — do NOT guess. If they pick a sprint, list its stories and
have them pick one (the \`ISSUE_KEY\` is required for a sprint push):

\`\`\`bash
testsigma sprints issues --sprint <work_cycle_id>
\`\`\`

## Choose a module (REQUIRED)

\`\`\`bash
testsigma modules list --project-id <project_id>
\`\`\`

Show \`MODULE_ID\` + \`NAME\` and ask the user to pick one, passed as \`--module\`. A new
\`--module <name>\` creates it on the fly. \`--module\` is mandatory; the push fails
without it. Optionally offer \`--priority <High|Medium|Low>\` and, if the tests were
run this session, \`--run-status <Passed|Failed>\`.

## Push (only after target + module are chosen)

\`\`\`bash
testsigma code push --project-id <project_id> --sprint <work_cycle_id> --issue <issue_key> --module <module_id_or_name> [--priority <High|Medium|Low>] [--run-status <Passed|Failed>]
\`\`\`

or the unmapped form (\`--unmapped\` replaces \`--sprint\`/\`--issue\`):

\`\`\`bash
testsigma code push --project-id <project_id> --unmapped --module <module_id_or_name> [--priority <High|Medium|Low>] [--run-status <Passed|Failed>]
\`\`\`

Do **not** pass \`--session-id\` or \`--input\` — the CLI auto-detects the session and
pushes exactly the \`*.spec.ts\` files changed this session. Report the per-test-case
results (\`created\`/\`updated\` with name + id). If it reports "Nothing to push," tell
the user no changed \`*.spec.ts\` files were found — they may need \`/arcus-test\` first.
`,
    'arcus-help.md':
      `---\ndescription: Show Arcus commands\n---\n\n` +
      `Arcus captures your Cursor session context into Testsigma.\n\n` +
      `- \`/arcus-login\` — sign in\n- \`/arcus-logout\` — sign out\n` +
      `- \`/arcus-project list [search]\` — list projects\n- \`/arcus-project use <id>\` — pin a project\n` +
      `- \`/arcus-project current\` — show pinned project\n- \`/arcus-map ticket <KEY>\` — map a ticket\n` +
      `- \`/arcus-test [feature]\` — author, validate & run Testsigma-script e2e tests\n` +
      `- \`/arcus-push\` — push authored test cases to Agentic Test\n`,
  };

  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body, 'utf8');
  }
}
