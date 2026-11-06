# Changing a test or element that is already pushed

A file that has a row in `arcus.lock` is *tracked*: it is a test or element that already exists in Arcus. The lock is at
the repo root, with repo-relative paths. To find out if a file is tracked, search `arcus.lock` for its path. Read the
lock. Never edit it.

A tracked file is not a draft. People see it in Arcus, and other tests may use it. Edit it on purpose, and say what you
changed.

## The file is its identity

The lock knows a test by the path of its file.

- **Do not rename or move the file.** A moved file is not recognised: the CLI refuses it (`probably moved from …`) and
  reports the old path as `missing`. Keep the file name even when the title changes.
- **Do not delete a tracked file** to remove a test. The CLI cannot delete from Arcus. A deleted file is only reported
  `missing`, and Arcus keeps the test. If the user wants a test gone, they remove it in Arcus.

## Editing a test

- **Change only what the request needs.** Edit the steps in place. The CLI matches your steps to the ones in Arcus by
  their text and place, sends only what changed, and leaves the rest alone, which also keeps edits that someone made in
  Arcus to other steps. Rewording, reordering or moving steps without need turns them into edits, moves, or removes plus
  inserts. That raises the chance of a conflict, and a push that adds or moves steps is refused when Arcus has newer
  edits.
- **Do not add or remove step keys.** If the file has keys that someone pinned, leave them.
- **Do not rename the title** unless the user asks. The title is what the team sees in Arcus, and a rename changes it
  for everyone. The new title must be free in the project, ignoring case. A rename is allowed and is pushed as
  `renamed`.
- Run the same loop as for a new test: `arcus check`, fix, `arcus fmt`, `arcus check` again.

## Editing an element

An element is replaced as a whole when pushed: Arcus gets your locator list, and the last write wins.

- **Find who uses it first.** Search the project's `tests/` for `@<path>`. Tell the user how many tests use it. A changed
  locator changes every one of them.
- **Do not rename or move an element.** A pushed element cannot be renamed or moved yet. Changing its declared name is
  refused (`ARC1107`). If the name is wrong, make a new element with a new path and change the tests to use it. The old element stays in
  Arcus.
- Locator order matters (see `references/elements.md`). Do not reorder for no reason.

## Files change under you

After a push, the CLI rewrites each file it pushed to the text that Arcus holds: canonical layout, and any edits that
other people made to other steps (the push report says `from Arcus: …`). So in a later turn, **read the file again before
you edit it.** Do not edit from a copy you read earlier.

## What you cannot see from here

The CLI has no command that tells you what Arcus holds now, and there is no `pull`. You cannot know if someone changed
a step in Arcus. The dry run in `/arcus-push` finds out: it reports `conflict` when the same step changed on both sides,
and `refused` when your edit adds or moves a step while Arcus has newer edits. Do not try to guess or to work around
either: tell the user what the dry run says.
