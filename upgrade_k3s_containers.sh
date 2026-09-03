#!/bin/bash
# Pull origin/main every 15 minutes. If git moved, refresh images and restart.
set -euo pipefail

REPO="${TRY_PLAYWRIGHT_REPO:-/root/try-playwright}"
STATE_DIR="${TRY_PLAYWRIGHT_STATE_DIR:-/var/lib/try-playwright}"
LOCK_FILE="${STATE_DIR}/autoupdate.lock"
LOG_PREFIX="try-playwright-autoupdate"

IMAGES=(
  ghcr.io/mxschmitt/try-playwright/frontend:latest
  ghcr.io/mxschmitt/try-playwright/control-service:latest
  ghcr.io/mxschmitt/try-playwright/squid:latest
  ghcr.io/mxschmitt/try-playwright/worker-javascript:latest
  ghcr.io/mxschmitt/try-playwright/worker-java:latest
  ghcr.io/mxschmitt/try-playwright/worker-python:latest
  ghcr.io/mxschmitt/try-playwright/worker-csharp:latest
)

# Match the historical host upgrade: bounce frontend/control so workers
# pick up new images. Do not restart file; its manifests/env can lag :latest.
APP_DEPLOYMENTS=(frontend control squid)

FORCE=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --help|-h)
      echo "Usage: $0 [--force] [--dry-run]"
      echo "  git fetch origin/main; if HEAD changed, pull images and restart."
      echo "  --force    update even if git did not move"
      echo "  --dry-run  print what would happen without changing the cluster"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [${LOG_PREFIX}] $*"
}

die() {
  log "ERROR: $*"
  exit 1
}

mkdir -p "${STATE_DIR}"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  log "another update is already running; exiting"
  exit 0
fi

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
command -v kubectl >/dev/null || die "kubectl not found"
command -v curl >/dev/null || die "curl not found"
command -v git >/dev/null || die "git not found"

if [[ -z "${KUBECONFIG:-}" && -f /etc/rancher/k3s/k3s.yaml ]]; then
  export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
fi

[[ -d "$REPO/.git" ]] || die "repo not found at ${REPO}"

BEFORE="$(git -C "$REPO" rev-parse HEAD)"
log "fetching origin/main (current ${BEFORE})"
git -C "$REPO" fetch --prune origin main
AFTER="$(git -C "$REPO" rev-parse origin/main)"
log "origin/main is ${AFTER}"

if [[ "$FORCE" -eq 0 && "$BEFORE" == "$AFTER" ]]; then
  log "no new commit; nothing to do"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "dry-run: would reset ${REPO} to ${AFTER}"
  log "dry-run: would pull ${#IMAGES[@]} images and restart ${APP_DEPLOYMENTS[*]}"
  exit 0
fi

if [[ "$FORCE" -eq 1 && "$BEFORE" == "$AFTER" ]]; then
  log "force mode: git did not move; refreshing images anyway"
else
  log "new commit ${BEFORE} -> ${AFTER}"
fi

git -C "$REPO" reset --hard origin/main

CRICTL=(k3s crictl)
if ! command -v k3s >/dev/null; then
  CRICTL=(crictl)
fi

for image in "${IMAGES[@]}"; do
  log "pulling ${image}"
  "${CRICTL[@]}" pull "$image"
done

log "restarting deployments: ${APP_DEPLOYMENTS[*]}"
restart_args=()
for deploy in "${APP_DEPLOYMENTS[@]}"; do
  restart_args+=("deployment/${deploy}")
done
kubectl rollout restart "${restart_args[@]}"
for deploy in "${APP_DEPLOYMENTS[@]}"; do
  kubectl rollout status "deployment/${deploy}" --timeout=180s
done

log "removing worker pods so they recreate on the new images"
kubectl delete pod -l role=worker --wait=false || true

log "waiting for application pods"
kubectl wait --timeout=180s --for=condition=ready pod -l io.kompose.service=frontend
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

log "deployed ${AFTER} successfully"
