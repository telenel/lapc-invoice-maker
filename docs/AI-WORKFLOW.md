# AI Workflow

Shared workflow rules for using Claude Code and local Codex in this repository.

This file is the source of truth for repo workflow behavior. Hard-coded checks and tool restrictions take priority over prompts, memory, and free-form agent instructions.

## Control Hierarchy

When two workflow rules disagree, follow this order:

1. GitHub branch protection and CI
2. Tracked hooks and scripts in this repo
3. Local agent permission files
4. Fixed prompt files and review wrappers
5. Plain-text docs, memory, and conversational instructions

## Required Local Commands

- `npm run ship-check`
- `npm run review:codex`
- `./scripts/publish-pr.sh`

These are the hard-coded workflow entrypoints. Do not replace them with ad hoc command sequences when preparing work for review.

## Default Workflow

1. Claude Code works locally in the checked-out repo and may create or switch branches.
2. Claude Code edits files, runs targeted commands when needed, and may commit locally.
3. Before anything is pushed, run `npm run ship-check`.
4. Run `npm run review:codex` from the same repo folder and branch.
5. If Codex finds issues, fix them locally and rerun `npm run ship-check` and `npm run review:codex`.
6. After both pass, use `./scripts/publish-pr.sh` to push the branch and open the PR.
7. User reviews the PR and decides when to merge.

## Agent Boundaries

### Claude Code

- May edit files, switch branches, run validation, commit, and push branches.
- Must not create or merge pull requests.
- Must rely on repo scripts and hooks rather than free-form workflow memory.

### Local Codex

- Must run from the same repo folder and branch as Claude Code.
- Performs the local review step via `npm run review:codex`.
- May make local fixes, commit them, and rerun the validation chain.
- May publish the branch and open the PR via `./scripts/publish-pr.sh`.

## Hard-Coded Enforcement

### `npm run ship-check`

- Requires a clean working tree.
- Runs `git status`, `npm run lint`, `npm test`, and `npm run build`.
- Records a stamp for the exact `HEAD` commit inside `.git/laportal/`.

### `npm run review:codex`

- Requires a clean working tree.
- Runs local Codex review against the current branch diff relative to `main` by default.
- Records a PASS/FAIL stamp for the exact `HEAD` commit inside `.git/laportal/`.
- Always completes the review and writes the stamp; a FAIL result does not abort the command.

### `hooks/pre-push`

- Refuses pushes when the current `HEAD` does not have a fresh `ship-check` stamp.
- Refuses pushes to branches that already have an open PR unless `CR_FIX=1` is set.

### `./scripts/publish-pr.sh`

- Requires a clean working tree.
- Requires a fresh `ship-check` stamp for the current `HEAD`.
- Requires a fresh PASS `review:codex` stamp for the current `HEAD`.
- Pushes the branch and opens the PR with GitHub CLI.

## GitHub Policy

- Required GitHub check: `Lint, Build & Test`
- CodeRabbit is advisory only and must not be treated as a required review gate.
- GitHub Actions are deterministic CI only. Local Codex review replaces GitHub Codex review for this repo.

## Local Requirements

- `gh` must be installed and authenticated
- `codex` must be installed locally and available on `PATH`
- `npm install` configures tracked hooks with `git config core.hooksPath hooks`

## Notes

- Both Claude Code and Codex must use the same working copy if they are expected to see the same branch and file changes.
- If a commit changes after `ship-check` or `review:codex`, rerun the affected command before pushing or opening a PR.
