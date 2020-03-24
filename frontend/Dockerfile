FROM node:13.10.1-buster-slim as client-builder

WORKDIR /frontend

COPY frontend/package.json /frontend
COPY frontend/package-lock.json /frontend
RUN npm install

COPY frontend/config-overrides.js frontend/tsconfig.json /frontend/
COPY frontend/public /frontend/public
COPY frontend/src /frontend/src

COPY types/ /types
RUN npm run build

FROM caddy/caddy:v2.0.0-beta.17-alpine

COPY frontend/Caddyfile /etc/caddy/Caddyfile

ENV SITE_ADDRESS=try.playwright.tech
COPY --from=client-builder /frontend/build /frontend
