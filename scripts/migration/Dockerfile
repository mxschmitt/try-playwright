FROM golang:1.15.3-buster as builder
WORKDIR /root
COPY go.mod /root/
COPY go.sum /root/
RUN go mod download

COPY scripts/migration/* /root/
RUN go build -o /app main.go

CMD ["/app"]