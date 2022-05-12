# Contribution guide

## Overview

The project uses different microservices to ensure a scalable service and is deployed using [k3s](https://k3s.io). All the services are written in [Go](https://golang.org).

## Development environment

For running everything locally the following setup is recommended:

### Frontend

`npm run start` starts the React.js development server. In the `package.json` the backend server can be configured.

### Microservices

Build the Docker containers each time and delete the deployment. Important there that the `--docker` is used, so that k3s will consider the local Docker images. See also [here](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/#forward-a-local-port-to-a-port-on-the-pod) how to forward a local Kubernetes Pod port to your Host localhost.

## Microservices overview

### RabbitMQ

RabbitMQ as a queue is used to distribute the worker jobs to its workers.

### Minio

Minio is used to store the artifacts (screenshots, videos, downloads) and delete them automatically after a few minutes.

### Etcd

Etcd is used to store the shared snippets.

### Squid

The Kubernetes Pods are isolated from the external internet and only http traffic is allowed. This gets proxied over the Squid proxy.

### File

The worker Pods only have access to the queue, file service, and squid proxy. The file proxy does upload the files to Minio after doing validation.

### Control

The control microservice is the server that receives requests from the user. It does create the corresponding workers, sends the messages to the queue, and responds to the user the response payload. Also it does store and serve the user snippets from Etcd.

### Worker

For each of the languages, there are individual Docker images and worker implementations since each language gets executed differently.

## Generate / Update autocompletion

- Execute the `update_pw.sh` script and adjust in it the Playwright version

## Infrastructure evolution

### 1st iteration

Classic frontend/backend architecture using React.js and express as a backend. The problem was that the backend also executed the arbitrary code from the user and took care of storing the snippets. Also, the system in a whole was not scaleable. So it had database access which was non-ideal.

### 2nd iteration

See [this](https://gist.github.com/mxschmitt/303ed443a0219dce51633ceb9eedb97e) Gist. I started using a microservice architecture using [k3s](https://k3s.io) and was able to scale up/down the different deployments individually. At this moment it only supported JavaScript snippets.

### 3rd iteration

The worker infra got rewritten, since the workers would share a lot of code each time: uploading artifacts to the storage server, listening for RabbitMQ messages, etc. For that, a [Go](https://golang.org) daemon was created which took care of that which all the workers now use and only slightly extend the execution logic. In this iteration support for [Java](https://github.com/microsoft/playwright-java), [.NET](https://github.com/microsoft/playwright-dotnet) and [Python](https://github.com/microsoft/playwright-python) was added.

## Updating Playwright

1. Execute `bash update_pw.sh 1.21`
1. Update the badge in the [./README.md](./README.md)
1. Create and merge the PR
1. Wait until PR is built on the `main` branch
1. Exeute the following on the host:
  - `k3s crictl img`
  - `k3s crictl rmi <image-ids>`
  - `kubectl delete pod -l io.kompose.service=control`

Then the new version should be live.
