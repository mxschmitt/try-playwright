ARG PLAYWRIGHT_VERSION=1.60.0
FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY worker-javascript/ ./worker-javascript/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app ./worker-javascript

# Debian slim + only the headless browsers the playground actually launches.
# The official mcr.microsoft.com/playwright:noble image is ~3.4GB because it
# ships Ubuntu, headed Chromium, WebKit GTK, headers, and extra tools.
FROM node:24-bookworm-slim

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NODE_PATH=/usr/local/lib/node_modules \
    DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

RUN npm install -g --omit=dev --no-audit --no-fund \
        playwright@${PLAYWRIGHT_VERSION} \
        @playwright/test@${PLAYWRIGHT_VERSION} \
        ts-node \
    && playwright install --with-deps chromium-headless-shell firefox webkit ffmpeg \
    && rm -rf /ms-playwright/webkit-*/minibrowser-gtk \
    && npm cache clean --force \
    && useradd --create-home --uid 1000 --shell /usr/sbin/nologin pwuser \
    && chmod -R 755 /ms-playwright \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /root/.npm /tmp/* \
        /usr/share/doc /usr/share/man /usr/share/lintian

WORKDIR /home/pwuser/
USER pwuser

COPY --from=builder /app /app

ENTRYPOINT ["/app"]
