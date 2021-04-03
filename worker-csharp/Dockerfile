FROM golang:1.16-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-csharp/main.go /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/playwright:v1.10.0-focal

RUN curl -o packages-microsoft-prod.deb https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb && \
    dpkg -i packages-microsoft-prod.deb && \
    apt-get update && \
    apt-get install -y apt-transport-https && \
    apt-get update && \
    apt-get install -y aspnetcore-runtime-5.0 dotnet-sdk-5.0

RUN apt-get remove -y python3.8 python3-pip git ssh xvfb curl nodejs && \
    apt-get autoremove -y

WORKDIR /home/pwuser/

USER pwuser

RUN mkdir /home/pwuser/project/ && \
    cd /home/pwuser/project/ && \
    dotnet new console && \
    dotnet add package PlaywrightSharp && \
    dotnet build && \
    bin/Debug/net5.0/.playwright/unix/native/playwright.sh install && \
    rm Program.cs

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]