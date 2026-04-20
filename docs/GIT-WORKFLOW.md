# Git Workflow

This repo is optimized for multi-machine and multi-agent handoffs without branch drift.

## Core rules

- GitHub is the source of truth. Local branches are disposable caches.
- One task gets one short-lived branch and one PR.
- One branch has one active writer at a time.
- Once a PR exists, that branch is for review fixes only.
- Always push before switching machines.

## One-time setup per machine

From repo root:

```bash
npm install
npm run git:bootstrap
```

That sets repo-local git safety defaults and, unless `--repo-only` is passed, the same defaults globally:

- `core.hooksPath=hooks`
- `pull.ff=only`
- `fetch.prune=true`
- `rerere.enabled=true`
- `merge.conflictStyle=zdiff3`
- `push.autoSetupRemote=true`

Use:

```bash
npm run git:bootstrap -- --repo-only
```

if you do not want the global git writes.

## Start new work

```bash
npm run git:start-branch -- feat/your-topic
```

The script:

- requires a clean working tree
- fetches `origin --prune`
- fast-forwards local `main` from `origin/main`
- blocks if the branch already exists locally or on GitHub
- creates the new branch from fresh `main`

## Resume existing work on another machine

```bash
npm run git:resume-branch -- feat/your-topic
```

The safe default:

- requires a clean working tree
- fetches `origin --prune`
- requires `origin/<branch>` to exist
- switches to the branch
- hard-resets to `origin/<branch>` if the local copy is only behind
- blocks on divergence or local-only commits

If GitHub should intentionally replace the local copy:

```bash
npm run git:resume-branch -- --discard-local feat/your-topic
```

## Validate before pushing

```bash
npm run ship-check
```

`ship-check` is strict by design:

- the tree must be completely clean
- no staged changes
- no unstaged changes
- no untracked files

If deploy metadata files appear locally, they are ignored by `.gitignore`, but any other stray files will still block the command.

`ship-check` runs:

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. writes a `HEAD` stamp to `.git/laportal/ship-check.env`

## Open the PR

```bash
npm run git:publish-pr
```

Current requirements:

- `gh` must be installed and authenticated
- working tree must be clean
- branch must not be `main`
- `ship-check` stamp must match the current `HEAD`
- the branch must not already have an open PR

The script then:

1. `git push -u origin <branch>`
2. `gh pr create --fill --base main --head <branch>`

## After the PR exists

Do not keep developing on that branch.

Only push follow-up review fixes with:

```bash
CR_FIX=1 git push
```

If `AUTOMERGE_PAT` is configured in GitHub, qualifying PRs targeting `main` get GitHub native auto-merge enabled automatically.

## What the pre-push hook blocks

The tracked `hooks/pre-push` hook runs on feature branches and blocks pushes when:

- no `ship-check` stamp exists
- the `ship-check` stamp does not match `HEAD`
- the local tracking ref is stale
- the push would not be a fast-forward of the remote branch tip
- the branch already has an open PR and `CR_FIX=1` is not set

Notes:

- the hook does not enforce these checks on `main`
- the open-PR check is skipped if `gh` is unavailable

## Agent rules

- Read this file before editing repo code.
- Do not have two writers working on the same branch at the same time.
- Start new work with `npm run git:start-branch -- <branch>`.
- Resume existing remote work with `npm run git:resume-branch -- <branch>`.
- Treat GitHub as authoritative once work has been pushed.
