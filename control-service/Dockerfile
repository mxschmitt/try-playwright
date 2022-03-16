FROM golang:1.18-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY control-service/* /root/
COPY internal/ /root/internal/

RUN CGO_ENABLED=0 GOOS=linux go build -o /app *.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
COPY --from=builder /app .
CMD ["/app"]