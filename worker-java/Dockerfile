ARG PLAYWRIGHT_VERSION=1.23.0
FROM golang:1.18-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-java/main.go /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright/java:v$PLAYWRIGHT_VERSION-focal

RUN apt-get remove -y git ssh xvfb curl && \
    apt-get autoremove -y

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION

USER pwuser
WORKDIR /home/pwuser/

RUN mkdir /home/pwuser/project/

COPY worker-java/pom.xml /home/pwuser/project/

RUN cd /home/pwuser/project/ && \
    mvn dependency:resolve-plugins dependency:go-offline

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]
