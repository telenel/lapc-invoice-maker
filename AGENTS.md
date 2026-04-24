# LAPortal Guide

## Critical data-safety rule — PRISM is read-only

The PRISM database (WinPRISM MSSQL, `PRISM_SERVER=winprism-la`, database `prism`) is strictly **read-only** for every agent at all times. Never issue INSERT, UPDATE, DELETE, DDL, or any other write operation against PRISM unless the user has given explicit per-action permission in the current conversation. Prior approvals do not generalize — each write requires fresh authorization.

Supabase is different. The LAPortal Supabase Postgres project (`wzhuuhxzxrzyasxvuagb`) is a writable mirror of PRISM. Migrations, RPC functions, schema changes, seed data, and backfills on Supabase are normal engineering work and require no special permission beyond ordinary review. Do not conflate "be careful with PRISM" with "be careful with Supabase" — they are two distinct systems.

If a task appears to require a PRISM write, stop, state the exact operation you believe is needed, and ask for explicit permission before issuing it. Do not infer consent from related approvals. When reading PRISM, prefer queries that are clearly side-effect-free (plain SELECT, no stored procedures with unknown write behavior).

## Read First

1. `README.md`
2. `docs/PROJECT-OVERVIEW.md`
3. `docs/SUPABASE-MIGRATION-STATUS.md` for infrastructure and deployment work
4. `prisma/schema.prisma` for data model changes

## Notes

- Worktrees are allowed and may be used when they are convenient for isolating or organizing work.
- Use the repo validation command before handing changes back.
- GitHub is the source of truth. Local branches are disposable caches.
- One branch has one active writer at a time across all machines and AI agents.

## Branching And PRs

- Start each machine with `npm install` and `npm run git:bootstrap`.
- Start each feature from fresh `main` with `npm run git:start-branch -- feat/thing`.
- Resume an existing remote branch on another machine with `npm run git:resume-branch -- feat/thing`.
- Use `npm run git:resume-branch -- --discard-local feat/thing` only when GitHub should overwrite the local branch copy.
- Create one focused branch per concern.
- Keep branches short-lived and do not stack branches.
- Commit often, but keep each commit scoped to the branch's one concern.
- After the first useful commit, run `npm run ship-check` and `npm run git:checkpoint` to push the branch and create/update its draft PR before switching tasks.
- Open or mark the PR ready with `npm run git:publish-pr` when the work is ready for review.
- Draft PRs are active-work handoffs and may receive more checkpoint pushes.
- Ready PRs are review surfaces; only push review fixes with `CR_FIX=1 git push`.
- Never switch away from committed local work until it is checkpointed, published, or explicitly parked in a named stash.
- Let CodeRabbit and CI review the PR.
- Merge before starting the next feature.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
