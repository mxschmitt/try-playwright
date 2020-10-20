FROM mcr.microsoft.com/playwright:v1.5.1-focal

WORKDIR /worker

COPY worker/package.json /worker
COPY worker/package-lock.json /worker
RUN npm ci

COPY worker/ /worker
COPY types/ /types
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "/worker/lib/index.js"]
