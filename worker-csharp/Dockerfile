ARG PLAYWRIGHT_VERSION=1.23.0
FROM golang:1.18-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-csharp/main.go /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright/dotnet:v${PLAYWRIGHT_VERSION}-focal

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1

RUN apt-get remove -y git ssh xvfb curl && \
    apt-get autoremove -y

WORKDIR /home/pwuser/

USER pwuser

RUN mkdir /home/pwuser/project/ && \
    cd /home/pwuser/project/ && \
    dotnet new console && \
    dotnet add package Microsoft.Playwright --version ${PLAYWRIGHT_VERSION} && \
    dotnet build && \
    rm Program.cs

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]