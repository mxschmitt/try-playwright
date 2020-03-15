FROM arjun27/playwright-bionic:0.2.0

WORKDIR /backend

USER root

COPY backend/package.json /backend
COPY backend/package-lock.json /backend
RUN npm install

COPY backend/ /backend
COPY types/ /types
RUN npm run build

ENV NODE_ENV=production

RUN mkdir -p /backend/public
RUN mkdir -p /backend/data

VOLUME [ "/backend/data" ]

CMD ["node", "/backend/lib/index.js"]
