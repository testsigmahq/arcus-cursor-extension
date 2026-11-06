# Reading the app before writing a test

The test must describe the real app. Read it from the repo first. Ask the user only for what the repo cannot tell you.

## What kind of app

- **Web:** a web framework in `package.json` (React, Vue, Svelte, Next, Angular), no mobile signals.
- **Mobile:** `android/`, `ios/`, an `.xcodeproj`, `pubspec.yaml`, React Native or Capacitor.
- **API only:** OpenAPI or Swagger files, or a backend framework with no UI. **Arcus tests cannot hold `api` steps yet:**
  the compile blocks them. Say so, and offer to test the UI that calls the API.

If the signals conflict or there are none, ask. Never guess. The answer also tells you if the project's platforms are
right (see `references/platforms.md`).

## Where the facts are

| Need | Look in |
|---|---|
| The URL to open | The dev-server config, `README`, `package.json` scripts, an env file's variable names. Ask which environment to test. Do not write an address you only guessed |
| The pages and the steps between them | The router (`routes`, `pages/`, `app/`), the page or screen components |
| Fields, buttons, links | The components: `data-testid`, `id`, `name`, `aria-label`, labels, placeholder text, visible button text |
| Messages that prove success or failure | The strings in the components and the translation files |
| Mobile controls | `accessibilityIdentifier` and `accessibilityLabel` on iOS; `android:id` and `contentDescription` on Android; Flutter or React Native test keys |
| Test data | Fixtures, seed files, the tests the repo already has |

## Choosing what a target says

Prefer, in this order: a test id made for tests, a stable id, an accessible label or role, visible text that will not
change, a short css selector, xpath. Prefer what a person would call the thing over its position in the page.

## Values and secrets

- Use test data. Never copy a real email, password, token or key from the repo, an env file or a fixture of real data
  into a test.
- A value that changes by environment or is secret is read as `{env.name}` (see `arcus docs --topic data`). Tell the user
  which names the test reads. The values do not belong in the file.
  A run gives those names their values: `--base-url` for `base_url`, `--var name=value` for the rest. List the names
  to the user so a run does not stop on `Unresolved reference`. A secret goes in as `--var name="$VARIABLE"` from the user's
  own shell (see `/arcus-run`), never typed.
- Do not read `.env*`, key files or credential files to find a value.

## What to ask

Only these, and one at a time: which behaviour to cover, which environment's URL, where a credential comes from, which
platform if the repo has several. Anything the repo answers, the repo answers.
