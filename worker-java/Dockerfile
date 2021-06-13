ARG PLAYWRIGHT_VERSION=1.12.1
FROM golang:1.16-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-java/main.go /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright/java:v$PLAYWRIGHT_VERSION-focal

RUN apt-get update && apt-get remove -y openjdk-11-jdk && \
    apt-get install -y openjdk-14-jdk

RUN apt-get remove -y python3.8 python3-pip git ssh xvfb curl nodejs && \
    apt-get autoremove -y

ENV JAVA_HOME=/usr/lib/jvm/java-14-openjdk-amd64
ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION

RUN adduser pwuser

RUN chown pwuser -R /ms-playwright

USER pwuser
WORKDIR /home/pwuser/

RUN mkdir /home/pwuser/project/

COPY worker-java/pom.xml /home/pwuser/project/

RUN cd /home/pwuser/project/ && \
    mvn dependency:resolve-plugins dependency:go-offline

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]
