ARG PLAYWRIGHT_VERSION=1.60.0
FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY worker-csharp/ ./worker-csharp/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app ./worker-csharp

FROM mcr.microsoft.com/playwright/dotnet:v${PLAYWRIGHT_VERSION}-noble AS playwright

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    DOTNET_NOLOGO=1 \
    NUGET_XMLDOC_MODE=skip \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /home/pwuser/

RUN for pkg in git openssh-client xvfb curl wget; do \
        apt-get purge -y "$pkg" || true; \
    done \
    && apt-get autoremove -y --purge \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /usr/share/man /usr/share/doc /tmp/*

USER pwuser

RUN mkdir /home/pwuser/project/ \
    && cd /home/pwuser/project/ \
    && dotnet new console \
    && dotnet add package Microsoft.Playwright --version ${PLAYWRIGHT_VERSION} \
    && dotnet build \
    && rm -f Program.cs \
    && dotnet nuget locals http-cache --clear \
    && dotnet nuget locals temp --clear \
    && rm -rf /tmp/*

FROM scratch
COPY --from=playwright / /
COPY --from=builder /app /app

ARG PLAYWRIGHT_VERSION=1.60.0
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    DOTNET_NOLOGO=1 \
    NUGET_XMLDOC_MODE=skip \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/share/dotnet \
    HOME=/home/pwuser \
    DOTNET_ROOT=/usr/share/dotnet

USER pwuser
WORKDIR /home/pwuser/
ENTRYPOINT ["/app"]
