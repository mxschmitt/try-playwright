FROM alpine:3.23

EXPOSE 3128

ADD ./squid/squid.conf /etc/squid/squid.conf

RUN apk add squid=7.3-r0

ENTRYPOINT ["squid", "-f", "/etc/squid/squid.conf", "-NYCd", "1"]
