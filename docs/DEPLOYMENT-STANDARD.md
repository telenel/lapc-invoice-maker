# Deployment Standard

Use this contract for repos that need fast, exact, rollback-safe VPS deploys.

## Non-negotiables

1. Deploy an exact SHA, not a moving branch tip.
2. Make the running app report immutable build identity.
3. Skip only when the live app already reports the target SHA and smoke checks pass.
4. Run pre-swap migration/invariant checks before replacing the live container.
5. Verify the live app after restart before declaring success.
6. Record every deploy attempt in an append-only log.
7. Roll back automatically on post-swap failure.

## Failure modes this prevents

- repo checkout says one SHA while the container still serves another
- `/api/version` reports a stale or hand-edited SHA
- GitHub validates one commit but the server deploys a later branch tip
- the app restarts onto a bad schema state because migrations were only attempted during startup
- smoke checks silently regress while the app still reports the target SHA

## Standard flow

### Normal `main` deploy

1. CI validates the exact Git SHA.
2. GitHub deploys that SHA over SSH when possible.
3. The VPS fetches the target ref and rejects the deploy if it does not resolve to the pinned SHA.
4. The VPS builds the candidate image.
5. The VPS runs pre-swap migration/invariant checks inside the candidate image.
6. Only then does the VPS replace the live container.
7. The VPS verifies `/api/version`, runs smoke checks, logs the result, and rolls back if post-swap verification fails.

### Hotfix deploy

1. Local reduced preflight runs.
2. The local script resolves the remote SHA first.
3. SSH deploy passes that exact SHA to the VPS.
4. The VPS uses the same build -> preflight -> swap -> verify -> rollback path.

## Required runtime contract

Every app should expose a small endpoint like `/api/version`:

```json
{
  "status": "ok",
  "buildSha": "abc1234",
  "buildTime": "2026-04-19T03:31:36Z"
}
```

That data should come from immutable build metadata baked into the image or runtime env, not from a manually edited file.

## Required VPS script behavior

The remote deploy script should:

1. fetch the target ref
2. compare the fetched commit to the expected SHA when one is provided
3. export runtime build metadata such as `BUILD_SHA` and `BUILD_TIME`
4. skip only when the live app already serves the target SHA and smoke checks pass
5. otherwise build the candidate image
6. run migration preflight before the live container is replaced
7. run any repo-specific invariant checks needed to prove the candidate image is safe
8. replace the live container only after that preflight succeeds
9. poll the live version endpoint until the target SHA is reported
10. run lightweight smoke checks
11. roll back on any failure after image replacement
12. append an audit record with actor/channel/ref/expected SHA/result

## Migration and invariant preflight

Do not rely on container startup to be the first place migrations run.

Preferred pattern:

```bash
docker compose build app
docker compose run --rm --no-deps --entrypoint sh app -lc '
  ./node_modules/.bin/prisma migrate deploy &&
  node ./scripts/check-products-derived-view.mjs
'
docker compose up -d --remove-orphans
```

Swap in your repo-specific invariant checks as needed.

## Required smoke checks

Every repo should define a tiny smoke set fast enough to run on every deploy:

- one version/health endpoint
- one public or unauthenticated route
- one route that proves the latest bundle/feature surface is serving correctly

If the live app already reports the target SHA but smoke checks fail, do not silently skip. Rebuild that SHA to self-heal or fail loudly.

## Required GitHub secrets

For SSH exact-SHA deploys:

- `DEPLOY_SSH_HOST`
- `DEPLOY_SSH_USER`
- `DEPLOY_SSH_PORT`
- `DEPLOY_SSH_KEY`
- `DEPLOY_REMOTE_PROJECT_DIR`

Fallback webhook deploys are compatibility-only. They should forward the expected SHA explicitly if they are kept at all.

## Reusable templates

- `templates/github-vps-sha-pinned-deploy.yml.example`
- `templates/vps-build-verify-rollback.sh.example`
- `templates/deploy-smoke-check.sh.example`
