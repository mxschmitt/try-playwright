FROM node:22-alpine as client-builder

WORKDIR /frontend

COPY frontend/package.json /frontend
COPY frontend/package-lock.json /frontend
RUN npm ci

COPY frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.node.json frontend/index.html /frontend/
COPY frontend/src /frontend/src

RUN npm run build

FROM golang:1.24-bookworm as server-builder

RUN go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest

RUN xcaddy build --with github.com/mholt/caddy-ratelimit

FROM alpine:3.21

COPY --from=server-builder /go/caddy /usr/bin/caddy
COPY frontend/Caddyfile /etc/caddy/Caddyfile

COPY --from=client-builder /frontend/dist /frontend

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
