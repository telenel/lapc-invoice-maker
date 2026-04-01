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

## Worktree And Session Briefs

- Worktrees are allowed and may be used when they help isolate changes, reduce churn, or make parallel work easier to manage.
- Always state which checkout is active: the absolute worktree path, the branch name, and the upstream tracking branch if one exists.
- If the checkout is a worktree, say so explicitly.
- Address the primary user as Marcos when giving workflow summaries.
- Include a short status brief at the start of any session or agent run.
- Include the same brief before committing, before pushing, and when opening or updating a PR.
- Include the same brief at the end of the session, plus the result and any next step.

### Required Status Brief

- Active worktree path
- Current branch
- Upstream tracking branch or `none`
- Current PR number, state, and URL or `none`
- Current workflow step
- What is about to happen next

### GitHub Workflow At A Glance

1. Start with a status brief.
2. Make changes in the active checkout or worktree.
3. Before committing, summarize the checkout, branch, and the intent of the commit.
4. Run `npm run ship-check`.
5. Run `npm run review:codex`.
6. Before pushing, summarize the branch, stamps, and the reason the push is happening.
7. Use `./scripts/publish-pr.sh` to push and open or update the PR.
8. After the PR is created, summarize the PR number, state, URL, and any follow-up needed.

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
- Prints the exact `HEAD` commit being validated before lint, test, and build.
- Prints whether a fresh local Codex review stamp already exists for that `HEAD`.
- Runs `git status`, `npm run lint`, `npm test`, and `npm run build`.
- Records a stamp for the exact `HEAD` commit inside `.git/laportal/`.

### `npm run review:codex`

- Requires a clean working tree.
- Runs local Codex review against the current branch diff relative to `main` by default.
- Supports `--base-ref <ref>` and `--focus <path>` to narrow the in-scope diff without leaving diff-relative review mode.
- Supports `npm run review:codex:json` or `npm run review:codex -- --json` to print the structured artifact.
- Records a PASS/FAIL stamp for the exact `HEAD` commit inside `.git/laportal/`.
- Writes the latest text report to `.git/laportal/codex-review.txt`.
- Writes the latest structured artifact to `.git/laportal/codex-review.json`.
- Keeps a rolling history of the last 20 review runs in `.git/laportal/review-history/`, plus `latest.txt` and `latest.json` pointers there.
- Always completes the review and writes the stamp; a FAIL result does not abort the command.
- The review output includes a scope summary of files/functions/areas inspected, and the prompt is expected to review the entire in-scope diff before deciding.

### `npm run review:codex:findings`

- Reads the latest structured artifact from `.git/laportal/codex-review.json`.
- Prints only the latest unresolved actionable findings for quick follow-up work.

### `npm run review:codex:live`

- Runs the normal local Codex review while streaming output.
- Looks for `LIVE-FINDING:` lines emitted by the review prompt hook.
- Appends each live finding to `.git/laportal/codex-review.live.jsonl`.
- Maintains a snapshot in `.git/laportal/codex-review.live.json` so an orchestrator can poll the live queue while the review is still running.

### `npm run review:codex:live:triage`

- Reads the live snapshot from `.git/laportal/codex-review.live.json`.
- Batches the current unresolved live findings with the same overlap rules as the final triage step.
- Intended for the orchestrator agent that is watching the live queue.

### `npm run review:codex:autopilot`

- One-command entrypoint for the live review-to-remediation workflow.
- Starts the live producer and the orchestrator together.
- The orchestrator is responsible for batching findings and delegating worker worktrees as they appear.
- Use this when you want the full pipeline, not just a review artifact.

### `npm run review:codex:triage`

- Reads the latest structured artifact from `.git/laportal/codex-review.json`.
- Groups unresolved findings into remediation batches by overlapping repo file ownership.
- Labels each batch as `worker-candidate` or `main-agent` so agents can avoid overlapping edits.
- Supports `npm run review:codex:triage -- --json` for machine-readable orchestration.

### `npm run review:codex:prompt`

- Prints a bounded worker prompt for one remediation batch from the latest artifact.
- Requires `--batch <BATCH_ID>`.

### `npm run review:codex:loop`

- Runs the normal local Codex review.
- If the result is `FAIL`, immediately prints the remediation triage output from the latest artifact.
- Keeps the existing review stamp and artifact contract intact.

### Live Orchestration Pattern

1. Start the pipeline with `npm run review:codex:autopilot`.
2. The wrapper starts the live producer and orchestrator automatically.
3. The orchestrator polls `.git/laportal/codex-review.live.jsonl` and `.git/laportal/codex-review.live.json` for new findings.
4. It uses the same batching rules from `npm run review:codex:triage`.
5. It generates worker prompts from the live snapshot with `npm run review:codex:prompt -- --artifact .git/laportal/codex-review.live.json --batch <BATCH_ID>`.
6. It creates separate worktrees for delegated batches.
7. It keeps polling until the final artifact is written, then reconciles the final report.

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
