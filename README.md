# Arcus for Cursor

Capture Cursor session context (file edits, git signals, hook events) and ingest
it into Arcus. Sessions are grouped by git branch and linked to an Arcus
workflow; you pick the project and map tickets — all from inside Cursor.

---

## Install

Install **Arcus** from the VS Code Marketplace, or from a `.vsix`:

```bash
cursor --install-extension arcus-1.0.0.vsix
```

In Cursor: **Extensions → `...` → Install from VSIX**.

Requires Cursor or VS Code 1.85+. `node` must be on the integrated-terminal
`PATH` — the `project` and `map` commands run a bundled Node CLI.

## Usage

1. `Cmd+Shift+P` → **Arcus: Sign In** → completes browser SSO
2. `/arcus-project use <id>` → pin the Arcus project
3. Work as usual — file saves and hook events are captured and ingested
4. `/arcus-map ticket <KEY>` → link the session's workflow to a ticket

Sign out any time with **Arcus: Sign Out**, which clears local credentials.

## Write, run and push Arcus tests

The extension installs four skills into `~/.cursor/skills`. They need the `arcus` CLI
(`npm i -g @testsigma/arcus-cli`, version 0.1.3 or newer). Ask in plain words, or type the name in the agent chat:

| Skill | What it does |
|---|---|
| `/arcus-setup` | Checks the CLI, your sign-in, the project, and whether this computer can run tests |
| `/arcus-author` | Writes a test as a `.sigma` file and checks it with `arcus check` |
| `/arcus-run` | Runs one web test in a browser on this computer, reads the result and the screenshot, and says whether the test, the app or the setup is wrong |
| `/arcus-push` | Shows which Arcus project and folder a push goes to, waits for your yes, then pushes and gives a link to each test |

`arcus auth login` (the CLI) is a separate sign-in from **Arcus: Sign In** (session capture). Session capture is
unchanged: it keeps running in the background while you use these skills.

The skills are generated from the Arcus Claude plugin. To update them:

```bash
npm run sync-skills -- <path to arcus-claude-plugin>/plugins/arcus
```

## Configuration

Open Settings (`Cmd+,`) → search `arcus`:

| Setting | Default | Purpose |
|---|---|---|
| `arcus.serverUrl` | `https://arcus.testsigma.com` | Browser sign-in, token exchange & refresh |
| `arcus.apiServerUrl` | `https://agentic-test.testsigma.com` | Receives hook/context events |
| `arcus.eventsPath` | `/api/v1/plugin/events` | Path on the API server accepting hook events |
| `arcus.logLevel` | `info` | `off` / `error` / `info` / `debug` |

Credentials are stored in the OS keychain plus a `0600` config file; there is no
plaintext token on disk. Logs go to **Output panel → Arcus**.

---

## Development

### Setup

```bash
git clone https://github.com/testsigmahq/arcus-cursor-extension
cd arcus-cursor-extension
npm install
```

Requires Node.js 18+ and npm 9+ (contributors only).

### Build

```bash
npm run build        # development build with source maps
npm run watch        # rebuild on every file change
npm run build:prod   # minified production build
```

Output lands in `dist/extension.js`.

### Lint

```bash
npm run lint
```

Uses ESLint v9 with flat config (`eslint.config.js`) and `@typescript-eslint` rules.

---

### Run from source

1. Open the `arcus-cursor-extension` folder in Cursor or VS Code
2. Press `F5` — launches an **Extension Development Host** window with the extension loaded
3. Edit source → `Ctrl+Shift+P` → **Developer: Reload Window** to pick up changes
4. Run `npm run watch` so rebuilds happen on save

### Test

```bash
npm test
bash hooks/capture_hook.test.sh
```

---

## Publishing

### Prerequisites

1. Publisher account at [marketplace.visualstudio.com](https://marketplace.visualstudio.com)
2. Publisher ID must match `"publisher"` in `package.json` (`testsigma`)
3. Personal Access Token (PAT):
   - `dev.azure.com` → User Settings → Personal Access Tokens
   - Scope: **Marketplace → Manage**

### Publish

```bash
npm install -g @vscode/vsce   # if not already installed globally

vsce login testsigma          # paste your PAT when prompted
npm run package               # builds arcus-x.x.x.vsix
vsce publish                  # pushes to VS Code Marketplace
```

Cursor reads from the VS Code Marketplace — no separate submission needed.

### Publish to Open VSX (optional but recommended)

```bash
npm install -g ovsx
ovsx publish arcus-1.0.0.vsix -p <open-vsx-token>
```

### Bumping versions

Update `version` in `package.json` before each publish. Follow semver:

| Change | Version bump |
|--------|-------------|
| Bug fix | PATCH `1.0.x` |
| New feature | MINOR `1.x.0` |
| Breaking change | MAJOR `x.0.0` |

Or let vsce handle it:

```bash
vsce publish patch   # bumps patch, builds, publishes
vsce publish minor
vsce publish major
```

---

## Project Structure

```
src/
├── extension.ts          # activate / deactivate entry point
├── config/
│   └── settings.ts       # read VS Code settings + SecretStorage
├── core/
│   ├── changeTracker.ts  # file save events → change log
│   ├── sessionManager.ts # session lifecycle and state
│   ├── gitHelper.ts      # git rev-parse, diff --stat, risk signal
│   └── logger.ts         # output channel logger
├── api/
│   ├── client.ts         # base HTTP client (no external deps)
│   └── events.ts         # post hook events to Arcus backend
├── commands/
│   ├── signIn.ts         # Arcus: Sign In
│   └── signOut.ts        # Arcus: Sign Out
└── ui/
    ├── reportPanel.ts    # webview panel for test reports
    └── statusBar.ts      # status bar item
```

---

## Commands

| Command | Description |
|---------|-------------|
| `Arcus: Sign In` | Sign in to Arcus via browser SSO |
| `Arcus: Sign Out` | Clear local credentials |

---

## Cursor slash commands

The extension provisions these commands into `~/.cursor/commands/` on activation:

| Command | What it does |
|---|---|
| `/arcus-login` | Sign in via browser SSO (opens through the extension) |
| `/arcus-logout` | Clear local credentials |
| `/arcus-project list [search]` | List Arcus projects |
| `/arcus-project use <id>` | Pin the active project |
| `/arcus-project current` | Show the pinned project |
| `/arcus-map ticket <KEY>` | Map a ticket to the current session's workflow |
| `/arcus-test [feature]` | Author Testsigma-script (code-v2) e2e tests via the `testsigma` CLI, validate them, and offer to run them |
| `/arcus-push` | Push the test cases authored this session into Agentic Test |
| `/arcus-help` | Show command help |

`/arcus-test` and `/arcus-push` drive the external `testsigma` CLI (must be on PATH;
it has its own `testsigma login`). `/arcus-push` also preflights the pinned project
through the bundled Node CLI.

**Requirement:** `node` must be on the integrated-terminal PATH (the `project`/`map`
commands run a bundled Node CLI). `login`/`logout` route to the extension via a
`cursor://` URL and have no Node dependency.
