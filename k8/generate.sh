#!/bin/bash

set -e

export DOCKER_TAG="${1:-latest}"
export WORKER_COUNT="${WORKER_COUNT:-4}"

for file_path in k8/*.yaml.tpl; do
    filename="$(basename $file_path)"
    envsubst < "$file_path" > "k8/generated-${filename/%.yaml.tpl/.yaml}"
done
