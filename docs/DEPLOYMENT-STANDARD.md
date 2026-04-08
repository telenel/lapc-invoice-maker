# Deployment Standard

This is the deployment contract to use across repos when the goal is:

- fast deploys
- exact accountability
- safe rollback
- no ambiguity about what is actually live

## Non-Negotiables

1. Deploy an exact SHA, not a moving branch.
2. Make the running image report its own build identity.
3. Skip only when the live app already reports the target SHA.
4. Verify the live app after restart before declaring success.
5. Record every deploy attempt in an append-only audit log.
6. Run at least one lightweight route smoke check before declaring success or skip.

## Failure Modes This Prevents

- repo checkout says one SHA while the container still serves another
- `/api/version` claims a manually edited SHA instead of the image actually serving traffic
- GitHub verifies one commit but the server deploys a later `main`
- “no changes detected” skips when the repo moved but the container did not
- deploy verifies the right SHA but a critical route is still broken

## Standard Flow

### Normal `main` deploy

1. CI validates the exact Git SHA.
2. GitHub deploys over SSH with that exact SHA pinned.
3. VPS fetches that ref and refuses to continue if it does not match the pinned SHA.
4. VPS builds the image, recreates the container, verifies the live SHA, and logs the outcome.
5. On verification failure, VPS rolls back to the last known-good commit.

### Hotfix deploy

1. Local reduced preflight runs.
2. Local script resolves the remote SHA first.
3. SSH deploy passes that SHA to the VPS.
4. VPS uses the same build / verify / rollback path as normal deploys.

## Required Runtime Contract

Every app should expose a lightweight endpoint like `/api/version` returning:

```json
{
  "status": "ok",
  "buildSha": "abc1234",
  "buildTime": "2026-04-08T03:31:36Z"
}
```

That value should come from immutable runtime build metadata baked into the image or container environment, not from a manually edited file.

## Required VPS Script Behavior

The remote deploy script should:

1. fetch the target ref
2. compare fetched commit to the expected SHA
3. export `BUILD_SHA` and `BUILD_TIME`
4. build the app image
5. recreate the container
6. poll the live version endpoint until the target SHA is reported
7. run lightweight smoke checks against critical routes
8. rollback on any failure after image replacement
9. append an audit record with actor, channel, ref, expected SHA, deployed SHA, and outcome

## Required Smoke Checks

Every repo should define a tiny smoke set that is fast enough to run on every deploy:

- one version/health endpoint
- one public or unauthenticated page
- one route that proves the latest bundle is being served

If the smoke checks fail when the live app already reports the target SHA, do not silently skip. Either rebuild the same SHA to self-heal or fail loudly so the operator sees that the live app is unhealthy.

## Required GitHub Secrets

For exact-SHA GitHub deploys, each repo should define:

- `DEPLOY_SSH_HOST`
- `DEPLOY_SSH_USER`
- `DEPLOY_SSH_PORT`
- `DEPLOY_SSH_KEY`
- `DEPLOY_REMOTE_PROJECT_DIR`

Fallback webhook deploys are acceptable only as a temporary compatibility path. They are weaker because they do not inherently guarantee exact-SHA execution unless the receiver explicitly forwards the pinned SHA.

## Reusable Templates

- [GitHub VPS Deploy Workflow Template](templates/github-vps-sha-pinned-deploy.yml.example)
- [VPS Build Verify Rollback Script Template](templates/vps-build-verify-rollback.sh.example)
- [Route Smoke Check Template](templates/deploy-smoke-check.sh.example)
