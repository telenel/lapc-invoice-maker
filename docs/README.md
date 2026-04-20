# Documentation Index

Use this page as the canonical navigation point for LAPortal documentation.

## Start Here

- [../README.md](../README.md) - repo quick start and high-level project summary
- [PROJECT-OVERVIEW.md](PROJECT-OVERVIEW.md) - architecture, routes, major flows, and integrations
- [DEPLOYMENT-STANDARD.md](DEPLOYMENT-STANDARD.md) - exact-SHA deploy contract and smoke-check requirements
- [GIT-WORKFLOW.md](GIT-WORKFLOW.md) - multi-machine branch handoff rules
- [HOTFIX-WORKFLOW.md](HOTFIX-WORKFLOW.md) - fast SSH deploy lane
- [SUPABASE-MIGRATION-STATUS.md](SUPABASE-MIGRATION-STATUS.md) - current platform and migration status

## Feature Guides

- [PRINT-SHOP-PRICING.md](PRINT-SHOP-PRICING.md) - print quote pricing notes
- [performance-testing.md](performance-testing.md) - Lighthouse and route audit workflow
- [prism/SCHEMA.md](prism/SCHEMA.md) - Prism database capability map
- [prism/field-usage.md](prism/field-usage.md) - Pierce field-usage snapshot
- [prism/ref-data-snapshot-2026-04-19.json](prism/ref-data-snapshot-2026-04-19.json) - committed ref fallback used by `/api/products/refs`

## Operations

- [templates/github-vps-sha-pinned-deploy.yml.example](templates/github-vps-sha-pinned-deploy.yml.example) - GitHub Actions deploy template
- [templates/vps-build-verify-rollback.sh.example](templates/vps-build-verify-rollback.sh.example) - VPS build/verify/rollback template
- [templates/deploy-smoke-check.sh.example](templates/deploy-smoke-check.sh.example) - route smoke-check template
- [ai/PROJECT-CONTEXT.md](ai/PROJECT-CONTEXT.md) - durable agent context
- [ai/WORKFLOW.md](ai/WORKFLOW.md) - agent workflow rules and validation gates
- [ai/SUPABASE-HANDOFF.md](ai/SUPABASE-HANDOFF.md) - Claude-facing Supabase context
- [ai/SESSION-LOG.md](ai/SESSION-LOG.md) - running session history
- [SUPABASE-MIGRATION-STATUS.md](SUPABASE-MIGRATION-STATUS.md) - platform migration record

## Historical Records

These files are preserved for traceability and handoff history. They are not the active source of truth for current behavior.

- [superpowers/specs/](superpowers/specs/) - design specs for each phase
- [superpowers/plans/](superpowers/plans/) - implementation plans and execution notes
- [QUOTE-INVOICE-WORKFLOW-AUDIT-2026-04-08.md](QUOTE-INVOICE-WORKFLOW-AUDIT-2026-04-08.md) - workflow audit record
- [prism/phase-1-verification-2026-04-19.md](prism/phase-1-verification-2026-04-19.md) - product phase verification notes
- [prism/raw/inventory.json](prism/raw/inventory.json) - raw Prism discovery dump

## Rule Of Thumb

If a file lives under `docs/superpowers/`, treat it as a historical phase artifact unless the current task explicitly says to work from a plan or spec. For day-to-day development, start with the files in the "Start Here" section above.
