FROM node:24-alpine AS client-builder

WORKDIR /frontend

# Component-test Playwright is unused for the production Vite build; skip its
# browser download so the builder layer stays smaller and faster.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY frontend/package.json /frontend
COPY frontend/package-lock.json /frontend
RUN npm ci --no-audit --no-fund \
    && npm cache clean --force

COPY frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.node.json frontend/index.html /frontend/
COPY frontend/public /frontend/public
COPY frontend/src /frontend/src

ARG GIT_SHA
ENV VITE_GIT_SHA=${GIT_SHA}

RUN npm run build \
    && mkdir -p /caddy-runtime/tmp /caddy-runtime/config /caddy-runtime/data \
    && chmod 1777 /caddy-runtime/tmp

FROM caddy:2.10.2-alpine AS caddy

# Official Caddy is a static binary; flatten onto scratch so Alpine (~8MB) and
# unused apk packages never ship. Keep CA certs and mime.types for HTTPS and
# correct static-asset Content-Type headers.
FROM scratch
COPY --from=caddy /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=caddy /etc/mime.types /etc/mime.types
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY --from=client-builder /caddy-runtime/config /config
COPY --from=client-builder /caddy-runtime/data /data
COPY --from=client-builder /caddy-runtime/tmp /tmp
COPY frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=client-builder /frontend/dist /frontend

ENV XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/data

EXPOSE 8080
CMD ["/usr/bin/caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
