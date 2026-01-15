FROM golang:1.25-alpine AS builder
WORKDIR /root
COPY go.mod go.sum /root/
RUN go mod download

COPY log-aggregator /root/log-aggregator
RUN CGO_ENABLED=0 GOOS=linux go build -o /app ./log-aggregator

FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /app /app
CMD ["/app"]
