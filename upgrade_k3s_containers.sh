#!/bin/bash
# Pull origin/main every 15 minutes. If a new commit is fully built, apply the
# k8/ manifests, refresh images and restart.
set -euo pipefail

REPO="${TRY_PLAYWRIGHT_REPO:-/root/try-playwright}"
GITHUB_REPO="mxschmitt/try-playwright"
# Secrets and settings for k8/generate.sh (RUSTFS_*, TURNSTILE_SECRET_KEY, ...).
ENV_FILE="${TRY_PLAYWRIGHT_ENV_FILE:-/etc/try-playwright/env}"
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
  ghcr.io/mxschmitt/try-playwright/log-aggregator:latest
)

APP_DEPLOYMENTS=(frontend file control squid log-aggregator)

# Resources whose manifests were removed from k8/. `kubectl apply` never deletes
# anything, so list them here to have them cleaned up on the next deploy.
RETIRED_RESOURCES=(
  deployment/minio
  service/minio
)

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
    log "dry-run: would apply k8/ manifests with ${ENV_FILE} and delete ${RETIRED_RESOURCES[*]}"
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

# Without this, manifest changes (new services, env vars, ingress routes) never
# reach the cluster and only image updates would be deployed. Generate before
# pulling images so a missing or broken env file fails fast. The env file is
# only sourced in the subshell so it cannot override this script's variables.
[[ -f "$ENV_FILE" ]] || die "env file ${ENV_FILE} not found; see README.md for the required variables"
log "generating k8/ manifests with ${ENV_FILE}"
(
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
  cd "$REPO" && bash k8/generate.sh
) || die "k8/generate.sh failed"

CRICTL=(k3s crictl)
if ! command -v k3s >/dev/null; then
  CRICTL=(crictl)
fi

for image in "${IMAGES[@]}"; do
  log "pulling ${image}"
  "${CRICTL[@]}" pull "$image"
done

log "applying k8/ manifests"
kubectl apply -f "$REPO/k8/"
log "deleting retired resources: ${RETIRED_RESOURCES[*]}"
kubectl delete "${RETIRED_RESOURCES[@]}" --ignore-not-found
kubectl rollout status deployment/rustfs --timeout=180s

# Delete workers before bouncing control so the new control process creates a
# fresh pool. Do not delete workers after control is ready. This stays after
# the apply: if apply fails, the old control keeps its working workers. A
# control rollout started by apply is superseded by the restart below.
log "removing worker pods before control restart"
kubectl delete pod -l role=worker --wait=false || true

log "restarting deployments: ${APP_DEPLOYMENTS[*]}"
restart_args=()
for deploy in "${APP_DEPLOYMENTS[@]}"; do
  restart_args+=("deployment/${deploy}")
done
kubectl rollout restart "${restart_args[@]}"
# rollout status waits until the new pods are ready. Avoid `kubectl wait -l`
# here: it also matches old pods that are still terminating and then fails
# with NotFound once they are gone.
log "waiting for application pods"
for deploy in "${APP_DEPLOYMENTS[@]}"; do
  kubectl rollout status "deployment/${deploy}" --timeout=180s
done

FRONTEND_PORT="$(kubectl get svc frontend -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || true)"
if [[ -n "$FRONTEND_PORT" ]]; then
  BASE_URL="http://127.0.0.1:${FRONTEND_PORT}"
else
  BASE_URL="http://127.0.0.1:8080"
fi
HEALTH_URL="${BASE_URL}/service/control/health"

log "checking health at ${HEALTH_URL}"
curl -fsS --max-time 10 --retry 12 --retry-all-errors --retry-delay 5 "$HEALTH_URL" >/dev/null \
  || die "health check failed"

# A missing object returns 404 only when file-service can reach object storage;
# a storage outage surfaces as 5xx.
STORAGE_URL="${BASE_URL}/file-uploads/00000000-0000-0000-0000-000000000000.png"
log "checking object storage via ${STORAGE_URL}"
storage_status=""
for _ in $(seq 1 12); do
  storage_status="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -I "$STORAGE_URL" || true)"
  [[ "$storage_status" == "404" ]] && break
  sleep 5
done
[[ "$storage_status" == "404" ]] || die "object storage check failed (HTTP ${storage_status:-none})"

printf '%s\n' "$AFTER" > "$STATE_FILE"
touch "$FILE_ROLL_MARKER"
log "deployed ${AFTER} successfully"
