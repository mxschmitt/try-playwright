FROM node:13.8.0-buster-slim as client-builder

WORKDIR /frontend

ADD frontend/package.json /frontend
ADD frontend/package-lock.json /frontend
RUN npm install

ADD frontend/ /frontend
ADD types/ /types
ENV GENERATE_SOURCEMAP=false
RUN npm run build

FROM arjun27/playwright-bionic:0.2.0

WORKDIR /backend

USER root

ADD backend/package.json /backend
ADD backend/package-lock.json /backend
RUN npm install

ADD backend/ /backend
ADD types/ /types
RUN npm run build

COPY --from=client-builder /frontend/build /backend/frontend

ENV NODE_ENV=production

CMD ["node", "/backend/lib/index.js"]
