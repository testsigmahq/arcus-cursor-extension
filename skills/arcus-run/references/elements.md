# Elements: when to make one, and how to choose its locators

An element is a named target with locators, kept in its own file and used in tests as `@<path>`. The format is in
`arcus docs --topic elements`; read it before writing the first element. This page is about judgement, not format.

## When to make an element

Make one when the target is:

- used in more than one step or more than one test (a login button, a search box);
- hard to find, so its locators deserve a name and an order;
- on more than one platform, and needs a different locator for each (`only web|android|ios`).

Leave a one-off target inline (`locate css "…"`). An element for every click is noise: the user has to read, review and
keep all of them.

## Where it goes, and what it is called

- The file is `<project folder>/elements/<path>.sigma`. The declared name equals the path under `elements/`, without
  `.sigma`. `check` refuses a file that says otherwise.
- A path uses lower-case letters, digits and hyphens, with `/` between parts. Group by screen or feature:
  `login/submit`, `checkout/pay-now`. A name that says what the thing is, not how it looks (`login/submit`, not
  `login/blue-button`).
- **Look first.** List the project's `elements/` folder. Reuse an element that is already there. Follow the way the
  existing ones are grouped.
- **Choose the path with care.** A pushed element cannot be renamed, moved or deleted from the CLI yet.

## Order of locators

The run tries the locators in the order written, so write the most stable first. A usual order: a test id or a plain id,
then a short css selector, then text-based locators, then xpath. Do not copy a long generated selector
(`div > div:nth-child(3) > …`): it breaks at the next layout change. Fewer locators that are right beat many that are
guesses.

Per platform, use `only <platform>` on a locator so that one element works everywhere. Device locator types and
which platform has them are in `arcus docs --topic locators`.

`autoheal off` only when the user asks for it. The default is on.

## Elements that exist only in Arcus

The CLI can see an element only if its file is in this repo. An `@path` with no local file fails `check` with
`CMP2104`. An element path that is already in Arcus, but not tracked from this folder, is refused at push:
`exists in Arcus and this folder does not track it`. Both mean the same thing for you: use another path, and write the
element file for it. Do not try to get around it.

## Never invent a locator

A locator that was not seen in the app's source, or given by the user, is a guess. Find real ones first (see
`references/reading-the-app.md`). If you cannot, write the element anyway when the user wants a
draft, but say in the report which locators are unconfirmed.

## Order of work

Write the element files first, then the tests that use them. `arcus check` looks for an `@path` among all the element
files of the project, whichever files you pass it, so a test is fine as soon as its element file exists. Check the
element files too: pass them to `arcus check` with the tests. `arcus push` sends elements before tests by itself.
