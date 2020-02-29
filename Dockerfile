FROM arjun27/playwright-bionic:0.2.0

USER root

ADD package.json /
RUN npm install

ADD src src
ADD tsconfig.json /

RUN npm run build

CMD node lib/index.js
