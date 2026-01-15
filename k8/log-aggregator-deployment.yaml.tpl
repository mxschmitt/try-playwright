apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    io.kompose.service: log-aggregator
  name: log-aggregator
spec:
  replicas: 1
  selector:
    matchLabels:
      io.kompose.service: log-aggregator
  template:
    metadata:
      labels:
        io.kompose.service: log-aggregator
    spec:
      containers:
        - env:
            - name: LOG_AGGREGATOR_PORT
              value: "8080"
          image: ghcr.io/mxschmitt/try-playwright/log-aggregator:${DOCKER_TAG}
          name: log-aggregator
          ports:
            - containerPort: 8080
          imagePullPolicy: IfNotPresent
      restartPolicy: Always
