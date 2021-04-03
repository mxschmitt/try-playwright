#!/bin/bash

set -e

export DOCKER_TAG="$1"

for file_path in k8/*.yaml.tpl; do
    filename="$(basename $file_path)"
    envsubst < "$file_path" > "k8/generated-${filename/%.yaml.tpl/.yaml}"
done