#!/bin/bash
# Pull origin/main every 15 minutes. If a new commit is fully built, refresh images and restart.
set -euo pipefail

REPO="${TRY_PLAYWRIGHT_REPO:-/root/try-playwright}"
GITHUB_REPO="mxschmitt/try-playwright"
STATE_DIR="${TRY_PLAYWRIGHT_STATE_DIR:-/var/lib/try-playwright}"
STATE_FILE="${STATE_DIR}/last-deployed-sha"
LOCK_FILE="${STATE_DIR}/autoupdate.lock"
LOG_PREFIX="try-playwright-autoupdate"

IMAGES=(
  ghcr.io/mxschmitt/try-playwright/frontend:latest
  ghcr.io/mxschmitt/try-playwright/file-service:latest
  ghcr.io/mxschmitt/try-playwright/control-service:latest
  ghcr.io/mxschmitt/try-playwright/squid:latest
  ghcr.io/mxschmitt/try-playwright/worker-javascript:latest
  ghcr.io/mxschmitt/try-playwright/worker-java:latest
  ghcr.io/mxschmitt/try-playwright/worker-python:latest
  ghcr.io/mxschmitt/try-playwright/worker-csharp:latest
)

APP_DEPLOYMENTS=(frontend file control squid)

FORCE=0
DRY_RUN=0
CONTINUE_SHA=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f) FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --continue)
      shift
      CONTINUE_SHA="${1:-}"
      if [[ -z "$CONTINUE_SHA" ]]; then
        echo "--continue requires a commit SHA" >&2
        exit 2
      fi
      ;;
    --help|-h)
      echo "Usage: $0 [--force] [--dry-run]"
      echo "  git fetch origin/main; if a new commit has a green CI run, pull images and restart."
      echo "  --force    update even if this SHA was already deployed (still waits for green CI)"
      echo "  --dry-run  print what would happen without changing the cluster"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift
done

log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [${LOG_PREFIX}] $*"
}

die() {
  log "ERROR: $*"
  exit 1
}

mkdir -p "${STATE_DIR}"

if [[ -z "$CONTINUE_SHA" ]]; then
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    log "another update is already running; exiting"
    exit 0
  fi
fi

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
command -v kubectl >/dev/null || die "kubectl not found"
command -v curl >/dev/null || die "curl not found"
command -v git >/dev/null || die "git not found"
command -v python3 >/dev/null || die "python3 not found"

if [[ -z "${KUBECONFIG:-}" && -f /etc/rancher/k3s/k3s.yaml ]]; then
  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
fi

[[ -d "$REPO/.git" ]] || die "repo not found at ${REPO}"

FILE_ROLL_MARKER="${STATE_DIR}/file-download-handler.ok"

LAST_DEPLOYED=""
if [[ -f "$STATE_FILE" ]]; then
  LAST_DEPLOYED="$(tr -d '[:space:]' < "$STATE_FILE")"
fi

if [[ -n "$CONTINUE_SHA" ]]; then
  AFTER="$CONTINUE_SHA"
  log "continuing deploy of ${AFTER} with repo script"
else
  log "fetching origin/main (last deployed ${LAST_DEPLOYED:-none})"
  git -C "$REPO" fetch --prune origin main
  AFTER="$(git -C "$REPO" rev-parse origin/main)"
  log "origin/main is ${AFTER}"

  NEED_FILE_ROLL=0
  if [[ ! -f "$FILE_ROLL_MARKER" ]]; then
    NEED_FILE_ROLL=1
  fi

  if [[ "$FORCE" -eq 0 && "$LAST_DEPLOYED" == "$AFTER" && "$NEED_FILE_ROLL" -eq 0 ]]; then
    log "no new commit; nothing to do"
    exit 0
  fi
  if [[ "$LAST_DEPLOYED" == "$AFTER" && "$NEED_FILE_ROLL" -eq 1 ]]; then
    log "SHA already deployed but file-service is not serving /file-uploads; rolling file"
  fi
fi

ci_status_for_sha() {
  local sha="$1"
  curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${GITHUB_REPO}/actions/runs?event=push&head_sha=${sha}&per_page=10" \
    | python3 -c '
import json, sys
data = json.load(sys.stdin)
runs = data.get("workflow_runs") or []
ci = [r for r in runs if str(r.get("path") or "").endswith("nodejs.yml") or r.get("name") == "CI"]
if not ci:
    print("missing")
    print("")
    print("")
    raise SystemExit(0)
run = ci[0]
print(run.get("status") or "unknown")
print(run.get("conclusion") or "")
print(run.get("html_url") or "")
'
}

if [[ -z "$CONTINUE_SHA" ]]; then
  mapfile -t CI_FIELDS < <(ci_status_for_sha "$AFTER") || die "failed to query GitHub Actions"
  CI_STATUS="${CI_FIELDS[0]:-missing}"
  CI_CONCLUSION="${CI_FIELDS[1]:-}"
  CI_URL="${CI_FIELDS[2]:-}"
  log "CI for ${AFTER}: status=${CI_STATUS} conclusion=${CI_CONCLUSION:-none} ${CI_URL}"

  if [[ "$CI_STATUS" != "completed" || "$CI_CONCLUSION" != "success" ]]; then
    log "waiting for a successful CI run before deploying"
    exit 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "dry-run: would reset ${REPO} to ${AFTER}"
    log "dry-run: would pull ${#IMAGES[@]} images and restart ${APP_DEPLOYMENTS[*]}"
    exit 0
  fi

  if [[ "$FORCE" -eq 1 && "$LAST_DEPLOYED" == "$AFTER" ]]; then
    log "force mode: redeploying ${AFTER}"
  else
    log "new commit ${LAST_DEPLOYED:-none} -> ${AFTER}"
  fi

  git -C "$REPO" reset --hard origin/main
  log "re-execing $(basename "$0") from ${AFTER} so image/restart lists match the commit"
  exec "$REPO/upgrade_k3s_containers.sh" --continue "$AFTER"
fi

CRICTL=(k3s crictl)
if ! command -v k3s >/dev/null; then
  CRICTL=(crictl)
fi

for image in "${IMAGES[@]}"; do
  log "pulling ${image}"
  "${CRICTL[@]}" pull "$image"
done

# Delete workers before bouncing control so the new control process creates a
# fresh pool. Do not delete workers after control is ready.
log "removing worker pods before control restart"
kubectl delete pod -l role=worker --wait=false || true

log "restarting deployments: ${APP_DEPLOYMENTS[*]}"
restart_args=()
for deploy in "${APP_DEPLOYMENTS[@]}"; do
  restart_args+=("deployment/${deploy}")
done
kubectl rollout restart "${restart_args[@]}"
for deploy in "${APP_DEPLOYMENTS[@]}"; do
  kubectl rollout status "deployment/${deploy}" --timeout=180s
done

log "waiting for application pods"
kubectl wait --timeout=180s --for=condition=ready pod -l io.kompose.service=frontend
kubectl wait --timeout=180s --for=condition=ready pod -l io.kompose.service=file
kubectl wait --timeout=180s --for=condition=ready pod -l io.kompose.service=control
kubectl wait --timeout=180s --for=condition=ready pod -l io.kompose.service=squid

FRONTEND_PORT="$(kubectl get svc frontend -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || true)"
if [[ -n "$FRONTEND_PORT" ]]; then
  HEALTH_URL="http://127.0.0.1:${FRONTEND_PORT}/service/control/health"
else
  HEALTH_URL="http://127.0.0.1:8080/service/control/health"
fi

log "checking health at ${HEALTH_URL}"
curl -fsS --retry 12 --retry-all-errors --retry-delay 5 "$HEALTH_URL" >/dev/null \
  || die "health check failed"

printf '%s\n' "$AFTER" > "$STATE_FILE"
touch "$FILE_ROLL_MARKER"
log "deployed ${AFTER} successfully"
