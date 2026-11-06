# Running a test: the result, the messages, and who owns a failure

`arcus run <file> --json` prints one JSON object on stdout. Read it. Do not guess from the exit code.

## The shape

```
{ sigmaLang, converter, runner, browser: {name, version} | null, platforms: [...],
  run: { path, title, status, durationMs, totalSteps, passedSteps, failedSteps, skippedSteps,
         failedStep?: {description, message, screenshot?}, problem?, interruptedAt?,
         diagnostics: [...], artifactsDir: <folder> | null } }
```

- `status` is `passed`, `failed`, `refused` or `interrupted`.
- `failedStep.description` is the step as written in the file. `message` is plain text. `screenshot` is the absolute path
  of a `.jpg` of the page at that step. Open it with the file read tool.
- `problem` is set when there is no failed step to show: the run was stopped, the browser went away, the test has no
  steps, or the run failed with no step error. `interruptedAt` is the step the run was on when it stopped.
- A run that hit the time limit is `failed`, with the step it was on and the message `timed out after N s`.
- `diagnostics` holds what `arcus check` found: the errors of a refused run, or the warnings of a run that went on.
- `artifactsDir` is the run's own folder, under `.arcus/runs/`. It holds `runner-output.log`, with the engine's own
  output. Read the log only for a `problem` that nothing else explains. `browser` and `artifactsDir` are `null` when the
  test was refused before a browser was chosen.
- Counts cover the steps that ran. After a failure the later steps are `skippedSteps`.

## Exit codes

| Exit | Means |
|---|---|
| `0` | passed |
| `1` | the test failed, was refused, or was interrupted: read `run.status` |
| `3` | this machine cannot run it, or an option is wrong. stdout is empty; stderr is JSON with `message`, `code`, `remediation` |

It is never `2`: a run does not talk to Arcus.

## Setup errors (exit 3)

| Message starts with | Owner | Say |
|---|---|---|
| `Cannot reach the Testsigma agent` | the user | Start the Testsigma agent. If it runs somewhere else, `arcus config set execution.localUrl <url>` |
| `Project "…" has platforms …; device runs are not supported yet` | the user | A run needs `web` in the project's platforms. Do not change them for the user |
| `Browser '…' is not available` | the user | Pick one from `arcus browsers list` |
| `The browser could not start` | the user | The binary the agent named cannot start. Name it. The log path is in the message |
| `--timeout …`, `--var …`, `--screenshots …`, `base_url is given twice` | you | You passed a wrong option. Fix it and run again |
| `no path was given`, `N paths were given`, `… is a folder`, `… is a pattern`, `… is not a test of project …`, `No such file or directory` | you | A run takes exactly one test file of the project. Name one |
| `The runner compiles sigma-lang …; this arcus runs …`, `The runner and this arcus … use different sigma-lang versions` | the user | The CLI and its runner do not match. The message says what to install. Usually `npm i -g @testsigma/arcus-cli` |

## Failure messages, and who usually owns them

The message tells you where to look. It does not decide the owner. The screenshot and the app decide.

| Message | Usually | Look at |
|---|---|---|
| `No element on the page matched this step's locator within 5s` | the test (a wrong locator) or the app (the control is gone) or timing (the page was still loading) | The screenshot: is the control on the page? Is it there under another label, or inside a frame? Is the page the one the test meant? |
| `Expected "…", but the actual …` and other verify mismatches (they name the element and the actual value) | the test (the wrong expected text) or the app (a wrong text) | The app source for that string. If the app and the test disagree about what is right, ask the user |
| `This URL could not be reached`, `The domain name could not be resolved` | the setup | The address in the `nav`. Is the app running? Is the address right, with the port? Do not change the test to another address without the user |
| `The certificate for … was rejected` | the setup | A self-signed staging certificate. Tell the user. Do not turn checks off |
| `Unresolved reference: "<name>" not found in environment` (in the log, or in the step message) | the setup | A `{env.<name>}` has no value. Pass `--var <name>=…`, or `--base-url` for `base_url` |
| `timed out after N s` | the app is slow, or a wait step is longer than the limit, or the run hung | The step it was on. A long `wait` is the test's. Do not raise `--timeout` just to pass |
| `The test has no steps to run` | the test | An empty test |
| `The run failed but no step reported an error`, `The runner returned no results` | the CLI or the runner | Show the message and the log path. Do not loop |

A failure that is the app's belongs to the user. Report it with the screenshot and the step. A test that rightly fails
because of a bug in the app is a good test. Do not change it.

## Reading the screenshot

The file read tool shows a `.jpg`. Look for: the page you expected (a login page when you expected the home page is a
navigation or sign-in problem, not a locator one), an error banner or a cookie wall that covers the control, the control
under a different label, a spinner that has not finished. Say what you see in a sentence.

## Options

| Option | Use |
|---|---|
| `--headed` | Show the browser. Only when asked, or to debug. Default is hidden |
| `--browser <name>` | A browser from `arcus browsers list`. Default: Chrome for Testing, then Chrome |
| `--screenshots all\|failed\|none` | Default `failed` |
| `--base-url <url>` | Sets `{env.base_url}`. A test must use it as `nav "{env.base_url}/path"`: there is no relative `nav` |
| `--var <name>=<value>` | Sets `{env.<name>}`. Repeat for more. A secret is passed as `"$VARIABLE"`, never typed |
| `--timeout <seconds>` | Default 300. Counts from the start of the browser |
| `--project <name>` | The project's folder name, or its id. Needed at a repo root with several projects |

## What the run leaves behind

`.arcus/runs/<id>/`, in the repo. It is local state, and git ignores it. A run never changes the test files,
`arcus.lock` or `.arcus/base/`.
