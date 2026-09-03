#!/usr/bin/env bash
#
# Bring up the full Try Playwright stack on a single-node k3s cluster running
# inside a Cloud Agent VM (nested container, no systemd). Idempotent: safe to
# re-run. See the "Cursor Cloud specific instructions" section in AGENTS.md.
#
# Overridable via env vars (sensible defaults for a local/dev demo):
#   WORKER_LANGUAGES  languages to enable (default: javascript)
#   WORKER_COUNT      warm workers per language (default: 1)
#   DOCKER_TAG        image tag to deploy (default: latest)
#   RUSTFS_ACCESS_KEY / RUSTFS_SECRET_KEY  S3 credentials for RustFS
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Deploy configuration. CI=1 makes k8/generate.sh leave TURNSTILE_SECRET_KEY
# empty, which makes control-service skip Turnstile validation (see
# control-service/turnstile.go), so snippets run without a captcha token.
export RUSTFS_ACCESS_KEY="${RUSTFS_ACCESS_KEY:-tryplaywright}"
export RUSTFS_SECRET_KEY="${RUSTFS_SECRET_KEY:-tryplaywright-secret}"
export WORKER_LANGUAGES="${WORKER_LANGUAGES:-javascript}"
export WORKER_COUNT="${WORKER_COUNT:-1}"
export DOCKER_TAG="${DOCKER_TAG:-latest}"
export LOG_AGGREGATOR_ENABLED="${LOG_AGGREGATOR_ENABLED:-false}"
export LOG_AGGREGATOR_URL="${LOG_AGGREGATOR_URL:-}"
export CI=1

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

# 1. System dependencies. envsubst (gettext-base) is used by generate.sh;
#    fuse-overlayfs is required as the containerd snapshotter (see step 3).
log "Ensuring system dependencies (gettext-base, fuse-overlayfs)"
missing=()
command -v envsubst >/dev/null || missing+=(gettext-base)
command -v fuse-overlayfs >/dev/null || missing+=(fuse-overlayfs)
if [ "${#missing[@]}" -gt 0 ]; then
  sudo apt-get update
  sudo apt-get install -y "${missing[@]}"
fi

# 2. Install the k3s binary without enabling/starting the systemd service
#    (the Cloud Agent VM has no systemd; we run k3s server directly).
if ! command -v k3s >/dev/null; then
  log "Installing k3s"
  curl -sfL https://get.k3s.io | INSTALL_K3S_SKIP_START=true INSTALL_K3S_SKIP_ENABLE=true sh -
fi

# 3. Start k3s server if it is not already responding.
#    Flags chosen for the sandboxed, nested-container environment:
#      --snapshotter=fuse-overlayfs  nested overlayfs is unsupported, and the
#                                    native snapshotter makes image size count
#                                    against the worker pod's ephemeral-storage
#                                    limit (eviction); fuse-overlayfs gives a
#                                    read-only lower layer.
#      --flannel-backend=host-gw     VXLAN device creation is blocked; host-gw
#                                    uses local routes (fine for one node).
#      --disable-network-policy      ipset is blocked in the sandbox.
#      --write-kubeconfig-mode=644   let non-root use kubectl.
if ! sudo k3s kubectl get nodes >/dev/null 2>&1; then
  log "Starting k3s server (fuse-overlayfs / host-gw)"
  sudo mkdir -p /var/log
  sudo bash -c 'nohup k3s server \
      --snapshotter=fuse-overlayfs \
      --write-kubeconfig-mode=644 \
      --flannel-backend=host-gw \
      --disable-network-policy \
      >/var/log/k3s.log 2>&1 &'
fi

log "Waiting for the node to become Ready"
for _ in $(seq 1 60); do
  if kubectl get nodes 2>/dev/null | grep -q ' Ready '; then break; fi
  sleep 3
done
kubectl wait --for=condition=Ready node --all --timeout=180s

# 4. Self-signed TLS secret referenced by the frontend Ingress.
if ! kubectl get secret try-playwright-cf-tls-cert >/dev/null 2>&1; then
  log "Creating self-signed TLS secret for the ingress"
  tmp="$(mktemp -d)"
  openssl req -x509 -nodes -days 730 -newkey rsa:2048 \
    -keyout "$tmp/tls.key" -out "$tmp/tls.crt" \
    -subj "/CN=try.playwright.tech/O=try.playwright.tech" 2>/dev/null
  kubectl create secret tls try-playwright-cf-tls-cert \
    --key="$tmp/tls.key" --cert="$tmp/tls.crt"
  rm -rf "$tmp"
fi

# 5. Generate manifests and apply. Prebuilt images are pulled from GHCR, so no
#    local image build is needed.
log "Generating manifests (WORKER_LANGUAGES=$WORKER_LANGUAGES, WORKER_COUNT=$WORKER_COUNT)"
bash k8/generate.sh "$DOCKER_TAG"

log "Applying manifests"
kubectl apply -f k8/

# 6. Wait for the core deployments to roll out.
log "Waiting for deployments to become available"
for d in etcd rabbitmq rustfs squid file log-aggregator control frontend; do
  kubectl rollout status "deploy/$d" --timeout=300s || true
done

kubectl get pods -o wide

cat <<'EOF'

Stack deployed. To reach it from the VM:
  kubectl port-forward svc/frontend 8080:8080

Then open http://localhost:8080 or run a snippet against the backend:
  curl -s -X POST http://localhost:8080/service/control/run \
    -H 'Content-Type: application/json' \
    -d '{"language":"javascript","token":"","code":"const { chromium } = require(\"playwright\");(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.setContent(\"<h1>hi</h1>\"); await p.screenshot({ path: \"out.png\" }); console.log(await p.title()); await b.close(); })();"}'
EOF
