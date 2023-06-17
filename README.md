# Try Playwright

![CI](https://github.com/mxschmitt/try-playwright/workflows/CI/badge.svg)
![Playwright version](https://img.shields.io/badge/Playwright-1.35.1-blue.svg)

> Interactive playground for [Playwright](https://github.com/microsoft/playwright) to run examples directly from your browser

## Setting up a Try Playwright environment with [k3s](https://k3s.io)

```sh
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik" sh -
apt update
apt install -y git
git clone https://github.com/mxschmitt/try-playwright.git
openssl req -x509 -nodes -days 730 -newkey rsa:2048 -keyout tls.key -out tls.crt -subj "/CN=try.playwright.tech/O=try.playwright.tech"
kubectl create secret tls try-playwright-cf-tls-cert --key=tls.key --cert=tls.crt
cd try-playwright
bash k8/generate.sh
kubectl apply -f k8/
```

For more information about the infrastructure and contributing, see [here](./CONTRIBUTING.md).
