ARG PLAYWRIGHT_VERSION=1.18.0
FROM golang:1.16-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-javascript/main.go /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-focal

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION

RUN apt-get remove -y python3.8 python3-pip git ssh xvfb curl && \
    apt-get autoremove -y

WORKDIR /home/pwuser/

RUN npm install -g playwright@${PLAYWRIGHT_VERSION}

USER pwuser

ENV NODE_PATH=/usr/lib/node_modules

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]