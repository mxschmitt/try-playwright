#!/bin/sh
set -eu

# Squid allocates descriptor-indexed tables during startup. Apple/container
# can pass through an unexpectedly large inherited RLIMIT_NOFILE; cap the
# soft limit until squid-cache/squid#2483 is available in the distribution.
ulimit -n 65536 2>/dev/null || true
exec squid -f /etc/squid/squid.conf -NYCd 1
