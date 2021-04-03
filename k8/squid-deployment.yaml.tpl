apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    io.kompose.service: squid
  name: squid
spec:
  replicas: 1
  selector:
    matchLabels:
      io.kompose.service: squid
  template:
    metadata:
      labels:
        io.kompose.service: squid
        reachable-by-worker: "true"
    spec:
      containers:
        - image: ghcr.io/mxschmitt/try-playwright/squid:${DOCKER_TAG}
          name: squid
          imagePullPolicy: IfNotPresent
      restartPolicy: Always
