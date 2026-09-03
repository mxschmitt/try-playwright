# AGENTS.md

Guidance for coding agents working in this repository.

## Project Summary

This is the Try Playwright monorepo. It contains:

- Go microservices (`control-service`, `file-service`)
- Go worker launchers for multiple language runtimes (`worker-*`)
- Shared Go packages under `internal/`
- React + Vite frontend (`frontend/`)
- Playwright end-to-end tests (`e2e/`)
- Kubernetes manifests and generation scripts (`k8/`)

## Tooling and Environment

- Go `1.26.x` (see `go.mod`)
- Node.js `20+` and npm
- Docker for image builds
- `kubectl` + k3s for full integration/e2e flows

## Repository Map

- `control-service/`: control API service
- `file-service/`: file upload/validation service
- `internal/`: shared Go code (`echoutils`, worker helpers, and types)
- `worker-javascript/`, `worker-java/`, `worker-python/`, `worker-csharp/`: language-specific worker containers
- `frontend/`: React app and Playwright component tests
- `e2e/`: browser/API Playwright tests against a running stack
- `k8/`: deployment templates/generated manifests
- `update_pw.mjs`: Playwright update/autocomplete helper

## Agent Workflow

1. Keep changes focused to the requested scope.
2. Reuse existing patterns in the touched service/package.
3. Avoid committing secrets, certificates, or local environment files.
4. Prefer `internal/` for shared Go logic used by multiple services/workers.
5. For Playwright version/autocomplete updates, use `node update_pw.mjs` instead of ad-hoc manual edits.

## Validation Commands

Run only the checks that match the area you changed.

### Go services/workers (repo root)

```bash
go test ./...
go build ./...
```

### Frontend (`frontend/`)

```bash
npm ci
npm run build
npx playwright test
```

### E2E (`e2e/`)

```bash
npm ci
npm test
```

Notes:

- E2E tests require a reachable deployed stack (default base URL is `http://localhost:8080`).
- CI commonly sets `ROOT_TEST_URL` when running e2e tests against k3s.

## Cursor Cloud specific instructions

These notes apply when working in a Cursor Cloud Agent VM.

### Environment

- The Cloud Agent environment is defined in `.cursor/environment.json`. Its `install` step prepares Go modules, frontend/e2e npm deps, the Playwright Chromium browser, and `gettext-base` (for `envsubst`). The `frontend-dev` terminal serves the Vite dev server on port `5173`.
- The frontend dev server proxies `/service/` to production, which is protected by Turnstile, so it cannot execute snippets on its own. To exercise the backend end-to-end, run the full stack on k3s (below).

### Running the full stack on k3s

Not every task needs the full stack, so k3s is not started automatically. When you need to run/test the backend (control-service, file-service, workers, RabbitMQ, RustFS, etcd, frontend) end-to-end, bring it up with:

```bash
bash k8/dev-k3s-up.sh
```

The script is idempotent and encodes the settings required to run k3s inside the sandboxed, nested-container VM (which has no systemd):

- Run `k3s server` directly (no systemd service).
- `--snapshotter=fuse-overlayfs`: nested `overlayfs` is unsupported, and the `native` snapshotter makes the image count against the worker pod's 512Mi ephemeral-storage limit (causing eviction).
- `--flannel-backend=host-gw`: VXLAN device creation is blocked in the sandbox.
- `--disable-network-policy`: `ipset` is blocked in the sandbox.
- Images are pulled prebuilt from `ghcr.io/mxschmitt/try-playwright/*` (no local build needed).
- `k8/generate.sh` is run with `CI=1`, leaving `TURNSTILE_SECRET_KEY` empty so `control-service` skips Turnstile validation (see `control-service/turnstile.go`) and snippets run without a captcha token.
- Defaults to `WORKER_LANGUAGES=javascript` and `WORKER_COUNT=1` to keep image pulls and resource usage small; override via env vars.

Verify end-to-end after `kubectl port-forward svc/frontend 8080:8080`:

```bash
curl -s -X POST http://localhost:8080/service/control/run \
  -H 'Content-Type: application/json' \
  -d '{"language":"javascript","token":"","code":"const { chromium } = require(\"playwright\");(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.setContent(\"<h1>hi</h1>\"); await p.screenshot({ path: \"out.png\" }); console.log(await p.title()); await b.close(); })();"}'
```

A successful response has `"success": true`, a Playwright `version`, console `output`, and a screenshot artifact under `files[].publicURL` (served via the frontend `/file-uploads/` proxy).

## Change Checklist

- Ensure modified Go files are `gofmt` formatted.
- Update docs/config when behavior changes.
- In change summaries, list the commands/tests you actually ran.
