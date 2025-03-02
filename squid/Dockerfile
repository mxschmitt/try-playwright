FROM alpine:3.20

EXPOSE 3128

ADD ./squid/squid.conf /etc/squid/squid.con

RUN apk add squid=6.9-r0

ENTRYPOINT ["squid", "-f", "/etc/squid/squid.conf", "-NYCd", "1"]
