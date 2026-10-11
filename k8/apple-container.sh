#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

CLUSTER_NAME="${CONTAINER_K8S_CLUSTER:-try-playwright}"
CLUSTER_CPUS="${CONTAINER_K8S_CPUS:-8}"
CLUSTER_MEMORY="${CONTAINER_K8S_MEMORY:-16g}"
IMAGE_TAG="${DOCKER_TAG:-apple-k8s}"
IMAGE_PREFIX="ghcr.io/mxschmitt/try-playwright"
PLATFORM="linux/arm64"

APPLICATION_IMAGES=(
  "worker-javascript"
  "file-service"
  "frontend"
  "control-service"
  "log-aggregator"
  "squid"
)

DEPENDENCY_IMAGES=(
  "docker.io/library/rabbitmq:4.0"
  "quay.io/coreos/etcd:v3.6.5"
  "docker.io/rustfs/rustfs:1.0.0-rc.5"
)

usage() {
  cat <<'EOF'
Usage: k8/apple-container.sh <up|build [image-directory ...]|dependencies|deploy|forward|status|down>

Commands:
  up             Create the cluster, build/load all local images, and deploy.
  build          Build and load all application images, or only those listed.
  dependencies   Pull and load the third-party images used by the manifests.
  deploy         Generate and apply the Kubernetes manifests.
  forward        Forward the frontend to http://127.0.0.1:8080.
  status         Show nodes, pods, and services.
  down           Delete the Apple container Kubernetes cluster.

Environment variables:
  CONTAINER_K8S_CLUSTER  Cluster name (default: try-playwright)
  CONTAINER_K8S_CPUS     Cluster CPUs (default: 8)
  CONTAINER_K8S_MEMORY   Cluster memory (default: 16g)
  DOCKER_TAG             Local image tag (default: apple-k8s)
  WORKER_COUNT           JavaScript workers (default: 1)
  RUSTFS_ACCESS_KEY      Local RustFS access key (default: tryplaywright)
  RUSTFS_SECRET_KEY      Local RustFS secret key (default: tryplaywright-local-secret)
  KEEP_LOCAL_IMAGES      Keep host image copies after loading (default: false)
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

cluster_exists() {
  container list --all --quiet | grep -Fxq "$CLUSTER_NAME"
}

cluster_running() {
  container list --quiet | grep -Fxq "$CLUSTER_NAME"
}

ensure_container_system() {
  if ! container system status >/dev/null 2>&1; then
    echo "Starting Apple container services"
    container system start
  fi
}

ensure_cluster() {
  ensure_container_system

  if ! cluster_exists; then
    echo "Creating Apple container Kubernetes cluster: $CLUSTER_NAME"
    container k8s create \
      --name "$CLUSTER_NAME" \
      --cpus "$CLUSTER_CPUS" \
      --memory "$CLUSTER_MEMORY"
  elif ! cluster_running; then
    echo "Starting Apple container Kubernetes cluster: $CLUSTER_NAME"
    if ! container k8s start --name "$CLUSTER_NAME"; then
      echo "Cluster restart failed. See apple/container#2158; delete the disposable cluster with '$0 down' if needed." >&2
      exit 1
    fi
  fi

  kubectl --context "$CLUSTER_NAME" wait \
    --for=condition=Ready "node/$CLUSTER_NAME" --timeout=3m
}

load_dependency_images() {
  ensure_cluster
  local image
  for image in "${DEPENDENCY_IMAGES[@]}"; do
    echo "Pulling $image for $PLATFORM"
    container image pull \
      --platform "$PLATFORM" \
      --max-concurrent-downloads 1 \
      "$image"
    echo "Loading $image into $CLUSTER_NAME"
    container k8s load-image \
      --name "$CLUSTER_NAME" \
      --platform "$PLATFORM" \
      "$image"
    if [[ "${KEEP_LOCAL_IMAGES:-false}" != "true" ]]; then
      container image delete "$image"
    fi
  done
}

build_and_load_images() {
  ensure_cluster
  local directories=("${APPLICATION_IMAGES[@]}")
  if (( $# > 0 )); then
    directories=("$@")
  fi

  local directory
  local image
  for directory in "${directories[@]}"; do
    if [[ ! -f "$directory/Dockerfile" ]]; then
      echo "Dockerfile not found: $directory/Dockerfile" >&2
      exit 1
    fi

    image="$IMAGE_PREFIX/$directory:$IMAGE_TAG"
    echo "Building $image for $PLATFORM"
    container build \
      --platform "$PLATFORM" \
      --cpus 4 \
      --memory 4g \
      --file "$directory/Dockerfile" \
      --tag "$image" \
      .
    echo "Loading $image into $CLUSTER_NAME"
    container k8s load-image \
      --name "$CLUSTER_NAME" \
      --platform "$PLATFORM" \
      "$image"
    if [[ "${KEEP_LOCAL_IMAGES:-false}" != "true" ]]; then
      # The cluster has its own containerd copy. Avoid storing the large
      # Playwright browser image twice on the host.
      container image delete "$image"
    fi
  done
}

deploy() {
  ensure_cluster

  # The kind node image contains this provisioner, but Apple's K8s plugin does
  # not install it automatically.
  container exec "$CLUSTER_NAME" \
    cat /kind/manifests/default-storage.yaml |
    kubectl --context "$CLUSTER_NAME" apply -f -

  export RUSTFS_ACCESS_KEY="${RUSTFS_ACCESS_KEY:-tryplaywright}"
  export RUSTFS_SECRET_KEY="${RUSTFS_SECRET_KEY:-tryplaywright-local-secret}"
  export WORKER_COUNT="${WORKER_COUNT:-1}"
  export WORKER_LANGUAGES="javascript"
  export LOG_AGGREGATOR_URL="${LOG_AGGREGATOR_URL:-http://log-aggregator:8080}"
  export LOG_AGGREGATOR_ENABLED="${LOG_AGGREGATOR_ENABLED:-true}"
  export TURNSTILE_SECRET_KEY="${TURNSTILE_SECRET_KEY:-}"

  # CI mode permits an empty Turnstile key, which disables it for this local
  # development deployment.
  CI=1 bash k8/generate.sh "$IMAGE_TAG"
  kubectl --context "$CLUSTER_NAME" delete \
    deployment,service minio --ignore-not-found
  kubectl --context "$CLUSTER_NAME" apply -f k8/

  kubectl --context "$CLUSTER_NAME" get deployments -o name |
    while IFS= read -r deployment; do
      kubectl --context "$CLUSTER_NAME" rollout status "$deployment" --timeout=10m
    done
  local worker_deadline=$((SECONDS + 600))
  until [[ "$(kubectl --context "$CLUSTER_NAME" get pods -l role=worker \
    --no-headers 2>/dev/null | wc -l | tr -d ' ')" -eq "$WORKER_COUNT" ]]; do
    if (( SECONDS >= worker_deadline )); then
      echo "Timed out waiting for $WORKER_COUNT JavaScript worker pod(s)" >&2
      return 1
    fi
    sleep 1
  done
  kubectl --context "$CLUSTER_NAME" wait \
    --for=condition=Ready pod -l role=worker --timeout=10m
}

status() {
  kubectl --context "$CLUSTER_NAME" get nodes -o wide
  kubectl --context "$CLUSTER_NAME" get pods -o wide
  kubectl --context "$CLUSTER_NAME" get services
}

forward() {
  echo "Try Playwright: http://127.0.0.1:8080"
  kubectl --context "$CLUSTER_NAME" port-forward service/frontend 8080:8080
}

down() {
  ensure_container_system
  if cluster_exists; then
    container k8s delete --name "$CLUSTER_NAME"
  else
    echo "Cluster does not exist: $CLUSTER_NAME"
  fi
}

require_command container
require_command kubectl
require_command envsubst

case "${1:-}" in
  up)
    build_and_load_images
    load_dependency_images
    deploy
    status
    echo
    echo "Run '$0 forward' and open http://127.0.0.1:8080"
    ;;
  build)
    shift
    build_and_load_images "$@"
    ;;
  dependencies)
    load_dependency_images
    ;;
  deploy)
    deploy
    ;;
  forward)
    forward
    ;;
  status)
    status
    ;;
  down)
    down
    ;;
  *)
    usage
    exit 1
    ;;
esac
