FROM node:13.8.0-buster-slim as client-builder

WORKDIR /frontend

COPY frontend/package.json /frontend
COPY frontend/package-lock.json /frontend
RUN npm install

COPY frontend/ /frontend/
COPY types/ /types
RUN npm run build

FROM caddy/caddy:v2.0.0-beta.15-alpine

COPY frontend/Caddyfile /etc/caddy/Caddyfile

COPY --from=client-builder /frontend/build /frontend
