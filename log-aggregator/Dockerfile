FROM golang:1.26-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY log-aggregator/ ./log-aggregator/

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /app ./log-aggregator \
    && mkdir -p /runtime/tmp && chmod 1777 /runtime/tmp

FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /runtime/tmp /tmp
COPY --from=builder /app /app
ENTRYPOINT ["/app"]
