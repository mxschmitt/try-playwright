ARG PLAYWRIGHT_VERSION=1.60.0
FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY worker-javascript/ ./worker-javascript/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app ./worker-javascript

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS playwright

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NODE_PATH=/usr/lib/node_modules

WORKDIR /home/pwuser/

# Official image already ships browsers in /ms-playwright. Skip a second
# browser download, drop unused CLI tools, and wipe package-manager caches in
# the same layer so they do not inflate the image.
RUN for pkg in git openssh-client xvfb curl wget; do \
        apt-get purge -y "$pkg" || true; \
    done \
    && apt-get autoremove -y --purge \
    && npm uninstall -g yarn \
    && npm install -g --omit=dev --no-audit --no-fund \
        playwright@${PLAYWRIGHT_VERSION} \
        @playwright/test@${PLAYWRIGHT_VERSION} \
        ts-node \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /root/.npm /tmp/*

# Flatten so purged packages are actually absent from the shipped layers.
FROM scratch
COPY --from=playwright / /
COPY --from=builder /app /app

ARG PLAYWRIGHT_VERSION=1.60.0
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_PATH=/usr/lib/node_modules \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HOME=/home/pwuser

USER pwuser
WORKDIR /home/pwuser/
ENTRYPOINT ["/app"]
