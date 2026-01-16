apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    io.kompose.service: file
  name: file
spec:
  replicas: 1
  selector:
    matchLabels:
      io.kompose.service: file
  template:
    metadata:
      labels:
        io.kompose.service: file
        reachable-by-worker: "true"
    spec:
      containers:
        - env:
            - name: FILE_HTTP_PORT
              value: "8080"
            - name: MINIO_ENDPOINT
              value: minio:9000
            - name: MINIO_ACCESS_KEY
              value: "${MINIO_ROOT_USER}"
            - name: MINIO_SECRET_KEY
              value: "${MINIO_ROOT_PASSWORD}"
            - name: FILE_SERVICE_SENTRY_DSN
              value: https://3911972a34944ec5bd8b681a252d4f1d@o359550.ingest.sentry.io/5479804
            - name: LOG_AGGREGATOR_URL
              value: "${LOG_AGGREGATOR_URL}"
            - name: LOG_AGGREGATOR_ENABLED
              value: "${LOG_AGGREGATOR_ENABLED}"
          image: ghcr.io/mxschmitt/try-playwright/file-service:${DOCKER_TAG}
          imagePullPolicy: IfNotPresent
          name: file
      restartPolicy: Always
