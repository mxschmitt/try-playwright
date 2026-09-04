ARG PLAYWRIGHT_VERSION=1.60.0
FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY worker-java/ ./worker-java/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app ./worker-java

FROM mcr.microsoft.com/playwright/java:v${PLAYWRIGHT_VERSION}-noble AS playwright

ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    MAVEN_OPTS="-Dorg.slf4j.simpleLogger.log.org.apache.maven.cli.transfer.Slf4jMavenTransferListener=warn"

RUN for pkg in git openssh-client xvfb curl wget; do \
        apt-get purge -y "$pkg" || true; \
    done \
    && apt-get autoremove -y --purge \
    && arch="$(dpkg --print-architecture)" \
    && ln -sfn "/usr/lib/jvm/java-25-openjdk-${arch}" /usr/lib/jvm/java-25-openjdk \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /usr/share/man /usr/share/doc /tmp/*

USER pwuser
WORKDIR /home/pwuser/

RUN mkdir /home/pwuser/project/

COPY worker-java/pom.xml /home/pwuser/project/

RUN cd /home/pwuser/project/ \
    && mvn -B -DskipTests dependency:resolve-plugins dependency:go-offline \
    && find /home/pwuser/.m2 -type f \( -name '*-sources.jar' -o -name '*-javadoc.jar' \) -delete

FROM scratch
COPY --from=playwright / /
COPY --from=builder /app /app

ARG PLAYWRIGHT_VERSION=1.60.0
ENV PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    HOME=/home/pwuser \
    JAVA_HOME=/usr/lib/jvm/java-25-openjdk

USER pwuser
WORKDIR /home/pwuser/
ENTRYPOINT ["/app"]
