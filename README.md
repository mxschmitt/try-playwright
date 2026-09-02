# Try Playwright

[![CI](https://github.com/mxschmitt/try-playwright/actions/workflows/nodejs.yml/badge.svg)](https://github.com/mxschmitt/try-playwright/actions/workflows/nodejs.yml)
[![Playwright Component Tests](https://github.com/mxschmitt/try-playwright/actions/workflows/playwright.yml/badge.svg)](https://github.com/mxschmitt/try-playwright/actions/workflows/playwright.yml)
![Playwright version](https://img.shields.io/badge/Playwright-1.60.0-blue.svg)

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
export RUSTFS_ACCESS_KEY="tryplaywright"
export RUSTFS_SECRET_KEY=$(openssl rand -base64 32)
bash k8/generate.sh
# Remove MinIO if this cluster was created before the RustFS migration.
kubectl delete deployment,service minio --ignore-not-found
kubectl apply -f k8/
```

For more information about the infrastructure and contributing, see [here](./CONTRIBUTING.md).
