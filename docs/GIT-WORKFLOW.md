# Git Workflow

This repo is optimized for working across multiple local machines and AI agents without branch drift.

## Core Rules

- GitHub is the source of truth. Local branches are disposable caches.
- One task maps to one short-lived branch and one PR.
- One branch has one active writer at a time.
- Draft PRs are active-work handoffs. Ready PRs are review surfaces.
- Once a PR is ready for review, that branch is only for review fixes. New scope goes on a new branch.
- Always push before switching machines.

## One-Time Setup Per Machine

From the repo root:

```bash
npm install
npm run git:bootstrap
```

That configures:

- repo-local hooks
- `pull.ff=only`
- `fetch.prune=true`
- `rerere.enabled=true`
- `merge.conflictStyle=zdiff3`
- `push.autoSetupRemote=true`

Use `npm run git:bootstrap -- --repo-only` if you do not want the machine-wide git settings.

## Start New Work

Use a fresh branch from a fresh `main`:

```bash
npm run git:start-branch -- feat/your-topic
```

That script:

- fetches `origin --prune`
- fast-forwards `main`
- creates a new branch from the updated `main`
- blocks if the branch name already exists locally or on GitHub

## Resume Existing Work On Another Machine

Do not trust the local copy of an existing branch. Re-sync it from GitHub first:

```bash
npm run git:resume-branch -- feat/your-topic
```

The safe default:

- fetches `origin --prune`
- switches to the branch
- resets to `origin/<branch>` when the local copy is simply behind
- blocks if this machine has local-only commits or diverged history

If GitHub is intentionally the source of truth and you want to discard this machine's local copy:

```bash
npm run git:resume-branch -- --discard-local feat/your-topic
```

## Publish Work

After the first useful commit, checkpoint it to GitHub:

```bash
npm run ship-check
npm run git:checkpoint
```

`npm run git:checkpoint` pushes the current branch and creates a draft PR if one does not exist. If a draft PR already exists, it pushes the new validated commit to that same draft PR. This is the standard way to avoid local-only commits when switching tasks or machines.

Before opening a PR:

```bash
npm run ship-check
npm run git:publish-pr
```

`npm run git:publish-pr` always checks for a `ship-check` stamp that matches the current `HEAD`. If a draft PR already exists for the branch, the script pushes the latest validated commit and marks that PR ready for review. If no PR exists, it pushes the branch and opens a ready PR. If `.git/laportal/codex-review.env` exists, the script also verifies that the review stamp matches `HEAD` and has `CODEX_REVIEW_RESULT=PASS`. If you want to require that extra review stamp before every PR publish, set `LAPORTAL_REQUIRE_CODEX_REVIEW=1` in your shell before running the command.

After the PR is open:

- do not continue feature work on that branch
- if the PR is draft, continue active work with `npm run ship-check && npm run git:checkpoint`
- if the PR is ready, only push review fixes with `CR_FIX=1 git push`
- put any new idea or scope change on a new branch from fresh `main`

## What The Hook Blocks

The tracked `pre-push` hook blocks pushes when:

- `ship-check` has not been run on the current `HEAD`
- the branch has a ready PR and you are not doing an explicit review-fix push
- the remote branch moved and this machine has stale tracking data
- the push would not be a fast-forward of the current remote branch tip

This is intentional. It forces clean handoffs between machines.

## AI Agent Rules

- Codex and Claude should both read this workflow before editing repo code.
- Agents must not develop on the same branch from two machines at the same time.
- Agents should start new work with `npm run git:start-branch -- <branch>`.
- Agents should resume remote work with `npm run git:resume-branch -- <branch>`.
- Agents should treat GitHub as authoritative once work has been pushed.
- Agents must not switch away from committed local work until it has been pushed with `npm run git:checkpoint`, published with `npm run git:publish-pr`, or explicitly parked in a named stash.
