# Platforms when writing

A project lists its platforms (`web`, `android`, `ios`). `arcus check` compiles **every test against every one of
them**, and a step that a platform skips is an error (`ARC2001`).

## The consequence

Platforms belong to the project, not to a test. A test with a web-only step (`nav`, `hover`, `press`, cookies…) cannot
live in a project whose platforms include `android` or `ios`: `check` fails on the mobile ones. And a test with
mobile-only steps (`swipe`, `launch app`, `press back`…) fails on `web`.

So before writing, compare what the user wants to test with the project's platforms:

- **They match:** go on.
- **The test is for one platform, and the project has more:** tell the user. Options: a separate Arcus project for that
  platform (`arcus init --project <id>` adds it to the same repo), or changing this project's platforms with
  `arcus project platforms add|remove` (their decision, since it makes `check` stricter or looser for every test).
  Do not rewrite a test into a weaker form just to make it compile everywhere.

## Writing for several platforms

- Default `arcus docs --project <name>` lists only the forms that compile on all of the project's platforms. Write from
  that list.
- A locator mode that a platform lacks is skipped there. For a target that has to work everywhere, make an element with
  one locator per platform (`only <platform>`). See `references/elements.md`.
- Looping over an element and some condition forms are web only. `arcus docs --all` marks the platforms of every form.

## Mobile

Authoring for Android and iOS works like web: `arcus docs` lists the device actions (app control, `swipe`, `pinch`,
`switch context`, and so on). **A run cannot test them yet.** `arcus run` runs web tests only, and stops on a project
without `web` in its platforms (`device runs are not supported yet`). So there is no device or app preflight. Say that
a mobile test is checked and pushed, not run. In a project that lists `web` and a mobile platform, `arcus run` first makes the same check as `arcus check`, which
compiles for every platform. A web-only step fails that check on the mobile platform, so the test is refused, not run.
If the user wants to run a web test, it belongs in a project whose platforms are all `web`.

## What cannot be written yet

If the user asks for one of these, say it is not supported yet, and do not work around it:

- `api` steps and add-on steps (blocked by the compile).
- Groups and calls to groups.
- `host` lines in an element.
- Header lines above a test (`sigmascript`, `platform`, `tags`).
- Sub-folders under `tests/`.
- Any action or form that `arcus docs --all` does not list.
