#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/hotfix-deploy.sh [--skip-preflight] [--dry-run] [ref]

Deploy a pushed branch or tag directly to the VPS over SSH using the existing
build-first deploy script on the server.

Environment:
  HOTFIX_SSH_HOST            Required. SSH host for the VPS.
  HOTFIX_SSH_USER            Optional. SSH user.
  HOTFIX_SSH_PORT            Optional. Defaults to 22.
  HOTFIX_REMOTE_PROJECT_DIR  Optional. Defaults to /opt/lapc-invoice-maker.
  HOTFIX_APP_URL             Optional. Defaults to https://laportal.montalvo.io/api/version.
  HOTFIX_TEST_COMMAND        Optional. Command run by hotfix-preflight when not skipped.

Examples:
  npm run hotfix:deploy -- main
  HOTFIX_TEST_COMMAND='npm test -- src/__tests__/public-quote-view.test.tsx' npm run hotfix:deploy -- hotfix/quote-review
EOF
}

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [ -f ./.env.hotfix ]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env.hotfix
  set +a
fi

skip_preflight=0
dry_run=0
deploy_ref=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-preflight)
      skip_preflight=1
      shift
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$deploy_ref" ]; then
        echo "ERROR: only one ref may be provided"
        usage
        exit 1
      fi
      deploy_ref="$1"
      shift
      ;;
  esac
done

if [ -z "$deploy_ref" ]; then
  deploy_ref=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
fi

if [ -z "$deploy_ref" ]; then
  echo "BLOCKED: no deploy ref provided and HEAD is detached."
  echo "Pass a pushed branch or tag explicitly."
  exit 1
fi

case "$deploy_ref" in
  *[!A-Za-z0-9._/-]*)
    echo "BLOCKED: deploy ref '$deploy_ref' contains unsafe characters."
    exit 1
    ;;
esac

if ! git ls-remote --exit-code --heads origin "$deploy_ref" >/dev/null 2>&1 \
  && ! git ls-remote --exit-code --tags origin "$deploy_ref" >/dev/null 2>&1; then
  echo "BLOCKED: ref '$deploy_ref' was not found on origin."
  echo "Push the branch/tag first, then retry."
  exit 1
fi

expected_sha=$(
  git ls-remote origin "refs/heads/$deploy_ref" "refs/tags/$deploy_ref" \
    | awk 'NR==1 { print $1 }'
)

if [ -z "$expected_sha" ]; then
  echo "BLOCKED: unable to resolve origin SHA for '$deploy_ref'."
  exit 1
fi

current_branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
if [ -n "$current_branch" ] && [ "$deploy_ref" = "$current_branch" ]; then
  git fetch origin "$deploy_ref" >/dev/null 2>&1
  local_sha=$(git rev-parse "$deploy_ref")
  remote_sha=$(git rev-parse FETCH_HEAD)
  if [ "$local_sha" != "$remote_sha" ]; then
    echo "BLOCKED: local branch '$deploy_ref' does not match origin/$deploy_ref."
    echo "Push the branch you want to deploy first."
    exit 1
  fi
fi

ssh_host="${HOTFIX_SSH_HOST:-}"
ssh_user="${HOTFIX_SSH_USER:-}"
ssh_port="${HOTFIX_SSH_PORT:-22}"
remote_project_dir="${HOTFIX_REMOTE_PROJECT_DIR:-/opt/lapc-invoice-maker}"
app_url="${HOTFIX_APP_URL:-https://laportal.montalvo.io/api/version}"

if [ -z "$ssh_host" ]; then
  echo "BLOCKED: HOTFIX_SSH_HOST is required."
  exit 1
fi

ssh_target="$ssh_host"
if [ -n "$ssh_user" ]; then
  ssh_target="${ssh_user}@${ssh_host}"
fi

if [ "$skip_preflight" -ne 1 ]; then
  "$repo_root/scripts/hotfix-preflight.sh"
fi

quoted_project_dir=$(printf '%q' "$remote_project_dir")
quoted_ref=$(printf '%q' "$deploy_ref")
quoted_expected_sha=$(printf '%q' "$expected_sha")
deploy_actor=$(printf '%q' "${USER:-unknown}")
remote_cmd="cd $quoted_project_dir && DEPLOY_CHANNEL=hotfix DEPLOY_ACTOR=$deploy_actor DEPLOY_EXPECTED_SHA=$quoted_expected_sha ./scripts/deploy-webhook.sh $quoted_ref"

echo "==> Hotfix deploy target"
echo "SSH target: $ssh_target"
echo "Ref: $deploy_ref"
echo "Expected SHA: $expected_sha"
echo "Remote project dir: $remote_project_dir"
echo "App URL: $app_url"
echo ""
echo "==> Remote command"
echo "$remote_cmd"

if [ "$dry_run" -eq 1 ]; then
  echo ""
  echo "Dry run only. No SSH command executed."
  exit 0
fi

echo ""
echo "==> ssh -p $ssh_port $ssh_target"
ssh -p "$ssh_port" -o BatchMode=yes "$ssh_target" "$remote_cmd"

echo ""
echo "==> Live version"
curl -fsS "$app_url"
echo ""
echo "Hotfix deploy complete"
