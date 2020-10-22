FROM mcr.microsoft.com/playwright:v1.5.1-focal

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

CMD ["node", "/home/pwuser/worker/lib/index.js"]
