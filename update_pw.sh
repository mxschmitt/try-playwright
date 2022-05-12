#!/bin/sh

PLAYWRIGHT_VERSION="$1"

if [ -z "$PLAYWRIGHT_VERSION" ]; then
  echo "Usage: $0 <playwright version>"
  exit 1
fi

function update_dependencies {
    cd $1
    npx npm-check-updates -u
    npm install
    cd ..
}

set -e

function get_npm_file() {
    echo "$(curl -sL https://unpkg.com/$1/$2)"
}

function update_playwright_types {
    TYPES_FILE="frontend/src/components/Editor/types.txt"
    echo "$(get_npm_file @types/node@14 globals.d.ts )" > $TYPES_FILE
    echo "declare module 'playwright-core' {" >> $TYPES_FILE
    echo "$(get_npm_file playwright-core@${PLAYWRIGHT_VERSION} types/protocol.d.ts)" >> $TYPES_FILE
    echo "$(get_npm_file playwright-core@${PLAYWRIGHT_VERSION} types/structs.d.ts)" | tail -n +19 >> $TYPES_FILE
    echo "$(get_npm_file playwright-core@${PLAYWRIGHT_VERSION} types/types.d.ts)" | tail -n +23 >> $TYPES_FILE
    echo "}" >> $TYPES_FILE
    echo "declare module 'playwright' {
        export * from 'playwright-core';
    }" >> $TYPES_FILE

    echo "declare module '@playwright/test-expect' {" >> $TYPES_FILE
    echo "$(get_npm_file @playwright/test@next types/expect-types.d.ts)" >> $TYPES_FILE
    echo "}" >> $TYPES_FILE


    echo "declare module '@playwright/test' {" >> $TYPES_FILE
    echo "$(get_npm_file @playwright/test@next types/test.d.ts)" | sed 's|@playwright/test/types/expect-types|@playwright/test-expect|g' >> $TYPES_FILE
    echo "}" >> $TYPES_FILE
}

function update_pw_dockerfile_versions {
    local languages=("csharp" "java" "javascript" "python")
    for language in "${languages[@]}"
    do
        local docker_file="./worker-${language}/Dockerfile"
        sed -i '' -e "s/ARG PLAYWRIGHT_VERSION=.*/ARG PLAYWRIGHT_VERSION=${PLAYWRIGHT_VERSION}/" $docker_file
    done
}


update_dependencies frontend
update_dependencies e2e
update_playwright_types
update_pw_dockerfile_versions
