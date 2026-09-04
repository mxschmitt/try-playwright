FROM alpine:3.23

EXPOSE 3128

# Alpine's CDN occasionally fails apk with "TLS: unspecified error", which
# then looks like a missing squid package. Try the CDN, then a second mirror.
RUN set -eux; \
    ok=0; \
    for mirror in \
        https://dl-cdn.alpinelinux.org/alpine \
        https://mirror.math.princeton.edu/pub/alpinelinux; do \
      printf '%s\n' \
        "${mirror}/v3.23/main" \
        "${mirror}/v3.23/community" \
        > /etc/apk/repositories; \
      attempt=0; \
      while [ "$attempt" -lt 3 ]; do \
        if apk add --no-cache squid; then \
          ok=1; \
          break; \
        fi; \
        attempt=$((attempt + 1)); \
        sleep $((attempt * 2)); \
      done; \
      [ "$ok" = 1 ] && break; \
    done; \
    [ "$ok" = 1 ]

COPY ./squid/squid.conf /etc/squid/squid.conf
COPY ./squid/entrypoint.sh /usr/local/bin/squid-entrypoint
ENTRYPOINT ["/usr/local/bin/squid-entrypoint"]
