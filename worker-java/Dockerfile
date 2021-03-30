FROM golang:1.16-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-java/* /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright/java:focal

RUN adduser pwuser
USER pwuser
WORKDIR /home/pwuser/

COPY worker-java/pom.xml /home/pwuser/

RUN mvn install

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]
