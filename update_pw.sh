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

read -r -d '' CUSTOM_SUFFIX << EOM
    export const webkit: BrowserType<WebKitBrowser>;
    export const chromium: BrowserType<ChromiumBrowser>;
    export const firefox: BrowserType<FirefoxBrowser>;
}

declare module 'playwright' {
    export * from 'playwright-core';
}

EOM

set -e

function get_playwright_file() {
    echo "$(curl -sL https://unpkg.com/playwright-core/$1)"
}

function update_playwright_types {
    TYPES_FILE="frontend/src/components/Editor/types.txt"
    cat e2e/node_modules/@types/node/globals.d.ts > $TYPES_FILE
    echo "declare module 'playwright-core' {" >> $TYPES_FILE
    echo "$(get_playwright_file types/protocol.d.ts)" >> $TYPES_FILE
    echo "$(get_playwright_file types/structs.d.ts)" | tail -n +19 >> $TYPES_FILE
    echo "$(get_playwright_file types/types.d.ts)" | tail -n +22 >> $TYPES_FILE
    echo "$CUSTOM_SUFFIX" >> $TYPES_FILE
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
