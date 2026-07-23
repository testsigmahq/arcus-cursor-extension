# Vibetest for Cursor

Exploratory testing for your code changes. Tracks file edits, generates test plans, and runs them in the cloud or locally — all from inside Cursor.

---

## Requirements

- Node.js 18+ (dev only — end users need nothing)
- npm 9+
- Cursor or VS Code 1.85+

---

## Development

### Setup

```bash
git clone https://github.com/testsigmahq/arcus-cursor-extension
cd arcus-cursor-extension
npm install
```

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

## Local Testing

### Option A — Extension Development Host (recommended during dev)

1. Open the `arcus-cursor-extension` folder in Cursor or VS Code
2. Press `F5` — launches a new **Extension Development Host** window with the extension loaded
3. Edit source → `Ctrl+Shift+P` → **Developer: Reload Window** to pick up changes
4. Use `npm run watch` in a terminal so rebuilds happen automatically on save

### Option B — Install the VSIX directly

```bash
npm run package
cursor --install-extension vibetest-0.1.0.vsix
```

Or in Cursor: **Extensions → `...` → Install from VSIX** → pick the `.vsix` file.

### First-run configuration

1. `Cmd+Shift+P` → **Vibetest: Set API Key** → enter your key
2. Open Settings (`Cmd+,`) → search `vibetest`:
   - `vibetest.serverUrl` — default `http://localhost:8800`
   - `vibetest.eventsPath` — default `/api/v1/plugin/events`
3. Save any file → status bar shows `⚗ Vibetest (1)`
4. `Cmd+Shift+P` → **Vibetest: Run Tests** → enter target URL

### Viewing logs

**Output panel → Vibetest** — all debug/info/error logs appear here.

Control verbosity via `vibetest.logLevel` setting: `off` / `error` / `info` / `debug`.

---

## Publishing

### Prerequisites

1. Create a publisher account at [marketplace.visualstudio.com](https://marketplace.visualstudio.com)
2. Publisher ID must match `"publisher"` in `package.json` (currently `testsigma`)
3. Generate a Personal Access Token (PAT):
   - Go to `dev.azure.com` → User Settings → Personal Access Tokens
   - Scope: **Marketplace → Manage**
4. Add a real 128×128 PNG as `assets/icon.png`
5. Add a `LICENSE` file

### Publish

```bash
npm install -g @vscode/vsce   # if not already installed globally

vsce login testsigma          # paste your PAT when prompted
npm run package               # builds vibetest-x.x.x.vsix
vsce publish                  # pushes to VS Code Marketplace
```

Cursor reads from the VS Code Marketplace — no separate submission needed.

### Publish to Open VSX (optional but recommended)

```bash
npm install -g ovsx
ovsx publish vibetest-0.1.0.vsix -p <open-vsx-token>
```

### Bumping versions

Update `version` in `package.json` before each publish. Follow semver:

| Change | Version bump |
|--------|-------------|
| Bug fix | PATCH `0.1.x` |
| New feature | MINOR `0.x.0` |
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
│   └── events.ts         # post hook events to Vibetest backend
├── commands/
│   ├── runTests.ts       # Vibetest: Run Tests
│   ├── showReport.ts     # Vibetest: Show Last Report
│   ├── setApiKey.ts      # Vibetest: Set API Key
│   └── clearSession.ts   # Vibetest: Clear Session
└── ui/
    ├── reportPanel.ts    # webview panel for test reports
    └── statusBar.ts      # status bar item
```

---

## Commands

| Command | Description |
|---------|-------------|
| `Vibetest: Run Tests` | Generate test plan and run against target URL |
| `Vibetest: Show Last Report` | Re-open report from last run |
| `Vibetest: Set API Key` | Store API key in OS keychain |
| `Vibetest: Clear Session` | Reset change log and start fresh session |

---

## Cursor slash commands

The extension provisions these commands into `~/.cursor/commands/` on activation:

| Command | What it does |
|---|---|
| `/arcus-login` | Sign in via browser SSO (opens through the extension) |
| `/arcus-logout` | Clear local credentials |
| `/arcus-project list [search]` | List Testsigma projects |
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
