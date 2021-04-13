ARG PLAYWRIGHT_VERSION=1.9.2
FROM golang:1.16-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY worker-csharp/main.go /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app

FROM mcr.microsoft.com/dotnet/sdk:6.0.100-preview.3-focal-amd64

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION

RUN adduser pwuser

WORKDIR /home/pwuser/

RUN apt-get update && \
    apt-get install -y curl

RUN apt-get install -y libglib2.0-0\
          libsoup2.4-1\
          libgtk-3-0\
          libcairo2\
          libgl1\
          libegl1\
          libnotify4\
          libgdk-pixbuf2.0-0\
          libvpx6\
          libopus0\
          libpango-1.0-0\
          libharfbuzz0b\
          libxml2\
          libxslt1.1\
          libwoff1\
          libfontconfig1\
          libfreetype6\
          libharfbuzz-icu0\
          libgstreamer-plugins-base1.0-0\
          libgstreamer1.0-0\
          libgstreamer-gl1.0-0\
          libgstreamer-plugins-bad1.0-0\
          libjpeg-turbo8\
          libpng16-16\
          libopenjp2-7\
          libwebpdemux2\
          libwebp6\
          libatk1.0-0\
          libenchant1c2a\
          libsecret-1-0\
          libhyphen0\
          libx11-6\
          libxcomposite1\
          libxdamage1\
          libwayland-server0\
          libwayland-egl1\
          libwayland-client0\
          libxkbcommon0\
          libepoxy0\
          libatk-bridge2.0-0\
          libgles2\
          gstreamer1.0-libav

USER pwuser

RUN mkdir /home/pwuser/project/ && \
    cd /home/pwuser/project/ && \
    dotnet new console && \
    dotnet add package PlaywrightSharp --version 0.192.0 && \
    dotnet build && \
    bin/Debug/net6.0/.playwright/unix/native/playwright.sh install && \
    rm Program.cs

COPY --from=builder /app /app

ENTRYPOINT [ "/app" ]