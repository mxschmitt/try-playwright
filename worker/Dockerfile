FROM mcr.microsoft.com/playwright:v1.9.1-focal

RUN apt-get remove -y python3.8 python3-pip git ssh xvfb && \
    apt-get autoremove -y

RUN apt-get remove -y nodejs && \
    curl -sL https://deb.nodesource.com/setup_15.x | bash - && \
    apt-get install -y nodejs

RUN rm -rf /var/lib/apt/lists/*

USER pwuser
RUN mkdir -p /home/pwuser/worker
WORKDIR /home/pwuser/worker

COPY worker/package.json /home/pwuser/worker/
COPY worker/package-lock.json /home/pwuser/worker/
RUN npm ci

COPY worker/ /home/pwuser/worker
COPY types/ /home/pwuser/types

ENV NODE_ENV=production

RUN npm run build

ENV FILE_SERVICE_URL=http://file:8080

CMD ["node", "/home/pwuser/worker/lib/index.js"]
