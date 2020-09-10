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

declare module 'playwright-chromium' {
    export * from 'playwright';
}

declare module 'playwright-firefox' {
    export * from 'playwright';
}

declare module 'playwright-webkit' {
    export * from 'playwright';
}

declare module 'playwright-video' {
    export const saveVideo: (page: import('playwright').Page, savePath: string) => Promise<({ stop: (() => Promise<void>) })>;
}

EOM

set -e

function update_playwright_types {
    TYPES_FILE="frontend/src/components/Editor/types.txt"
    cat backend/node_modules/@types/node/ts3.1/globals.d.ts > $TYPES_FILE
    echo "declare module 'playwright' {" >> $TYPES_FILE
    cat backend/node_modules/playwright/types/protocol.d.ts >> $TYPES_FILE
    cat backend/node_modules/playwright/types/types.d.ts | tail -n +21 >> $TYPES_FILE
    echo "$CUSTOM_SUFFIX" >> $TYPES_FILE
}


update_dependencies frontend
update_dependencies backend
update_playwright_types
update_dependencies .
