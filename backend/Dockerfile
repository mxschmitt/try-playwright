FROM mcr.microsoft.com/playwright:bionic

WORKDIR /backend

USER root

COPY backend/package.json /backend
COPY backend/package-lock.json /backend
RUN npm ci

COPY backend/ /backend
COPY types/ /types
RUN npm run build

ENV NODE_ENV=production

RUN mkdir -p /backend/public
RUN mkdir -p /backend/data

VOLUME [ "/backend/data" ]

CMD ["node", "/backend/lib/index.js"]
