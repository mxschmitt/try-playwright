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

## Local development on Apple silicon

On macOS 26, the complete application can run natively as `linux/arm64` with
Apple's [`container`](https://github.com/apple/container) Kubernetes plugin.
Application and dependency images are loaded directly into the cluster, so no
registry push or login is required.

Install `container`, `kubectl`, and `envsubst`, then run:

```sh
bash k8/apple-container.sh up
```

The script creates a disposable 8-CPU/16-GiB cluster, builds the application
images, loads them together with RabbitMQ, etcd, and RustFS, installs kind's
default storage provisioner, and deploys the manifests. The local profile uses
one JavaScript worker to keep the build and iteration loop manageable.

In another terminal, expose the frontend:

```sh
bash k8/apple-container.sh forward
```

Open <http://127.0.0.1:8080>. To iterate on selected services, rebuild and
redeploy them without pushing images:

```sh
bash k8/apple-container.sh build frontend control-service
bash k8/apple-container.sh deploy
```

Use `bash k8/apple-container.sh status` to inspect the deployment and
`bash k8/apple-container.sh down` to delete it. The cluster name, resources,
image tag, worker count, and host image retention are configurable; run the
script without arguments for the full list.

Apple's Kubernetes plugin is experimental, so treat these clusters as
disposable. At the time of writing,
[apple/container#2158](https://github.com/apple/container/pull/2158) is needed
to restart a stopped cluster after its VM address changes. Initial creation
and deployment do not depend on that fix.

For more information about the infrastructure and contributing, see [here](./CONTRIBUTING.md).
