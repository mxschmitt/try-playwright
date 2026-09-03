#!/bin/bash

set -e

DOCKER_TAG="${1:-latest}"
GIT_SHA="$(git rev-parse HEAD)"
DOCKER_IMAGE_DIRECTORIES=("worker-javascript" "worker-java" "worker-python" "worker-csharp" "file-service" "frontend" "control-service" "squid")

for dir in ${DOCKER_IMAGE_DIRECTORIES[*]}; do
  docker build . --file $dir/Dockerfile --tag "ghcr.io/mxschmitt/try-playwright/$dir:$DOCKER_TAG" --build-arg GIT_SHA="$GIT_SHA"
done
