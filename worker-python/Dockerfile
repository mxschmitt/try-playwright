ARG PLAYWRIGHT_VERSION=1.23.0
FROM golang:1.18-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-python/main.go /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright/python:v${PLAYWRIGHT_VERSION}-focal

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION

RUN apt-get remove -y git ssh xvfb curl && \
    apt-get autoremove -y

WORKDIR /home/pwuser/

RUN pip install playwright==${PLAYWRIGHT_VERSION}

USER pwuser

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]