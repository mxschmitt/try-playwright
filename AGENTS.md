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

## Change Checklist

- Ensure modified Go files are `gofmt` formatted.
- Update docs/config when behavior changes.
- In change summaries, list the commands/tests you actually ran.
