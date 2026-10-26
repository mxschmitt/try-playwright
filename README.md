# Try Playwright

[![CI](https://github.com/mxschmitt/try-playwright/actions/workflows/nodejs.yml/badge.svg)](https://github.com/mxschmitt/try-playwright/actions/workflows/nodejs.yml)
[![Playwright Component Tests](https://github.com/mxschmitt/try-playwright/actions/workflows/playwright.yml/badge.svg)](https://github.com/mxschmitt/try-playwright/actions/workflows/playwright.yml)
![Playwright version](https://img.shields.io/badge/Playwright-1.64.0-blue.svg)

> Interactive playground for [Playwright](https://github.com/microsoft/playwright) to run examples directly from your browser

## Setting up a Try Playwright environment with [k3s](https://k3s.io)

```sh
curl -sfL https://get.k3s.io | sh -
apt update
apt install -y git
git clone https://github.com/mxschmitt/try-playwright.git
openssl req -x509 -nodes -days 730 -newkey rsa:2048 -keyout tls.key -out tls.crt -subj "/CN=try.playwright.tech/O=try.playwright.tech"
kubectl create secret tls try-playwright-cf-tls-cert --key=tls.key --cert=tls.crt
cd try-playwright
# Settings for k8/generate.sh. upgrade_k3s_containers.sh reads the same file on every deploy.
mkdir -p /etc/try-playwright
(umask 077; cat > /etc/try-playwright/env <<EOF
TURNSTILE_SECRET_KEY=<your Turnstile secret key>
RUSTFS_ACCESS_KEY=tryplaywright
RUSTFS_SECRET_KEY=$(openssl rand -hex 32)
LOG_AGGREGATOR_ENABLED=false
LOG_AGGREGATOR_URL=
EOF
)
set -a; . /etc/try-playwright/env; set +a
bash k8/generate.sh
# Remove MinIO if this cluster was created before the RustFS migration.
kubectl delete deployment,service minio --ignore-not-found
kubectl apply -f k8/
```

### Automatic updates

`upgrade_k3s_containers.sh` (run from cron every 15 minutes) deploys `origin/main` once its CI run is green: it regenerates and applies `k8/` with `/etc/try-playwright/env`, deletes resources listed in `RETIRED_RESOURCES`, pulls the images, restarts the app deployments and checks control and object storage health. When removing a manifest from `k8/`, add its resources to `RETIRED_RESOURCES`.

For more information about the infrastructure and contributing, see [here](./CONTRIBUTING.md).
