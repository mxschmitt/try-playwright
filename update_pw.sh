#!/bin/sh

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

declare module 'playwright-video' {
    export const saveVideo: (page: import('playwright').Page, savePath: string) => Promise<({ stop: (() => Promise<void>) })>;
}

EOM

set -e

function update_playwright_types {
    TYPES_FILE="frontend/src/components/Editor/types.txt"
    echo "declare module 'playwright' {" > $TYPES_FILE
    curl https://cdn.jsdelivr.net/npm/playwright@next/types/protocol.d.ts >> $TYPES_FILE
    curl https://cdn.jsdelivr.net/npm/playwright@next/types/types.d.ts | tail -n +21 >> $TYPES_FILE
    echo "$CUSTOM_SUFFIX" >> $TYPES_FILE
}

update_playwright_types

update_dependencies frontend
update_dependencies backend
update_dependencies .
