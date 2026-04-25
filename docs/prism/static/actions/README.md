# Per-action static analyses

A WPAdmin user action — "add a GM item", "discontinue an item", "create a vendor", etc. — does not map cleanly to a single binary or a single SQL statement. It is a workflow that fans out across one or more binaries, calls one or more stored procs, and may compose SQL at runtime that is invisible to the binary.

Each file in this folder takes one such action and answers, **using only the static-analysis substrate** (string extracts + cross-binary catalog), three questions:

1. **What entrypoint does WPAdmin actually call?** — The literal proc-call string or SQL statement that initiates the action, with parameter signature.
2. **What does the action visibly do?** — Every literal SQL statement that fires as part of the workflow, the secondary writes, the related lookups.
3. **What is invisible to static analysis?** — Honest enumeration of the blind spots: encapsulated proc bodies, runtime-composed SQL, triggers, side effects we can only confirm dynamically.

These docs are the **static** half of the picture. To confirm the full call sequence (including triggers, the proc body, the actual order of operations), pair with a snapshot/diff session — see [`../../winprism-reverse-engineering.md`](../../winprism-reverse-engineering.md) for that track.

## Files

- [`add-item-gm.md`](add-item-gm.md) — Adding a new General Merchandise item via Item Maintenance.
- [`generate-invoices.md`](generate-invoices.md) — Generating AR (customer / department) invoices, both batch auto-gen and manual entry.
- [`create-ar-agency.md`](create-ar-agency.md) — Creating an AR agency (department billing account, e.g. `PSP 26 ANTHRO`).

## Pattern

When you analyze a new action, name the file by the action verb + scope: `<verb>-<scope>.md`. Examples: `discontinue-item.md`, `edit-item-gm.md`, `add-vendor.md`, `create-style-template.md`.

Cite line numbers from the strings dumps so future-you can verify quickly:

```
ItemMnt.dll.strings.txt:3485
```

Distinguish between **observed strings** (what's literally in the binary) and **inferences** (what we deduce from the strings). Use plain language for the latter — "presumably", "likely", "appears to" — so the reader can tell at a glance which claims are evidence-based vs reasoned.
