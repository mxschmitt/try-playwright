FROM golang:1.16-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-javascript/* /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright:v1.10.0-focal

RUN apt-get remove -y python3.8 python3-pip git ssh xvfb curl && \
    apt-get autoremove -y

WORKDIR /home/pwuser/

COPY --from=builder /app /app

RUN npm install -g playwright@1.10

USER pwuser

ENV NODE_PATH=/usr/lib/node_modules

ENTRYPOINT [ "/app" ]