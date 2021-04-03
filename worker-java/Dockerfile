FROM golang:1.16-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-java/main.go /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright/java:focal

RUN apt-get remove -y openjdk-11-jdk && \
    apt-get install -y openjdk-14-jdk

ENV JAVA_HOME=/usr/lib/jvm/java-14-openjdk-amd64


RUN adduser pwuser
USER pwuser
WORKDIR /home/pwuser/

RUN mkdir /home/pwuser/project/

COPY worker-java/pom.xml /home/pwuser/project/

RUN cd /home/pwuser/project/ && \
    mvn install

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]
