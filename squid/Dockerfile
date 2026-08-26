FROM alpine:3.23

EXPOSE 3128

ADD ./squid/squid.conf /etc/squid/squid.conf

RUN apk add --no-cache squid

COPY ./squid/entrypoint.sh /usr/local/bin/squid-entrypoint
ENTRYPOINT ["/usr/local/bin/squid-entrypoint"]
