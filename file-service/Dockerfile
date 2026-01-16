FROM golang:1.25-alpine AS builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY file-service/* /root/
COPY internal/ /root/internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o /app main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /app .
CMD ["/app"]