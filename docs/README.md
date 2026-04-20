# Documentation Index

Start here for current LAPortal docs.

## Core docs

- `../README.md` — repo quick start and high-level workflow summary
- `PROJECT-OVERVIEW.md` — current architecture, route/domain map, and platform behavior
- `SUPABASE-MIGRATION-STATUS.md` — current Supabase/platform status and verification commands

## Developer workflow

- `GIT-WORKFLOW.md` — enforced branch, push, and PR rules
- `HOTFIX-WORKFLOW.md` — fast SSH hotfix lane using the same VPS deploy engine
- `DEPLOYMENT-STANDARD.md` — reusable exact-SHA deploy contract and guardrails

## Operational references

- `PRINT-SHOP-PRICING.md` — pricing reference
- `performance-testing.md` — Lighthouse/perf workflow notes
- `prism/SCHEMA.md` — Prism-side schema notes

## Agent-facing docs

- `../AGENTS.md` — short repo guidance for agentic tools
- `../CLAUDE.md` — same guidance for Claude Code
- `ai/WORKFLOW.md` — AI handoff workflow and durable infra rules
- `ai/SUPABASE-HANDOFF.md` — Supabase-specific handoff notes
- `ai/PROJECT-CONTEXT.md` — historical project context

## Templates

- `templates/github-vps-sha-pinned-deploy.yml.example` — GitHub Actions deploy template
- `templates/vps-build-verify-rollback.sh.example` — VPS deploy script template
- `templates/deploy-smoke-check.sh.example` — smoke-check template

## Working / historical material

These are useful references, not the primary source of truth for current production behavior:

- `superpowers/specs/` — feature design specs
- `superpowers/plans/` — implementation plans
- `ai/SESSION-LOG.md` — session notes
