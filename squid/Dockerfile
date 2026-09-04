FROM alpine:3.24

EXPOSE 3128

RUN apk add --no-cache squid

COPY ./squid/squid.conf /etc/squid/squid.conf
COPY ./squid/entrypoint.sh /usr/local/bin/squid-entrypoint
ENTRYPOINT ["/usr/local/bin/squid-entrypoint"]
