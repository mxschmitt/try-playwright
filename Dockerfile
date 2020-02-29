FROM arjun27/playwright-bionic:0.2.0

USER root

RUN npm install -g yarn

ADD yarn.lock /
ADD package.json /
RUN npm install

ADD src src
ADD tsconfig.json /

RUN yarn build

CMD node lib/index.js
