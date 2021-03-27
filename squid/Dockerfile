FROM alpine:3

EXPOSE 3128

ADD ./squid/squid.conf /etc/squid/squid.con

RUN apk add squid

ENTRYPOINT ["squid", "-f", "/etc/squid/squid.conf", "-NYCd", "1"]
