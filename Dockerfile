FROM node:13.8.0-buster-slim as client-builder

ADD frontend/package.json /
ADD frontend/package-lock.json /
RUN npm install

ADD frontend/ /
RUN npm run build

FROM arjun27/playwright-bionic:0.2.0

USER root

ADD backend/package.json /
ADD backend/package-lock.json /
RUN npm install

ADD backend/ /
RUN npm run build

COPY --from=client-builder /build /frontend

CMD node lib/index.js
