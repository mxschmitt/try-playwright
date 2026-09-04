ARG PLAYWRIGHT_VERSION=1.60.0
FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY worker-python/ ./worker-python/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app ./worker-python

FROM mcr.microsoft.com/playwright/python:v${PLAYWRIGHT_VERSION}-noble AS playwright

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /home/pwuser/

RUN for pkg in git openssh-client xvfb curl wget; do \
        apt-get purge -y "$pkg" || true; \
    done \
    && apt-get autoremove -y --purge \
    && pip install --no-cache-dir playwright==${PLAYWRIGHT_VERSION} \
    && find /usr/local /usr/lib -type d -name __pycache__ -prune -exec rm -rf {} + \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /root/.cache /tmp/*

FROM scratch
COPY --from=playwright / /
COPY --from=builder /app /app

ARG PLAYWRIGHT_VERSION=1.60.0
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HOME=/home/pwuser

USER pwuser
WORKDIR /home/pwuser/
ENTRYPOINT ["/app"]
