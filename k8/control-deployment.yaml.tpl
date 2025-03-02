apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    io.kompose.service: control
  name: control
spec:
  replicas: 1
  selector:
    matchLabels:
      io.kompose.service: control
  template:
    metadata:
      labels:
        io.kompose.service: control
    spec:
      serviceAccountName: control-user
      containers:
        - env:
            - name: WORKER_COUNT
              value: "${WORKER_COUNT}"
            - name: CONTROL_HTTP_PORT
              value: "8080"
            - name: ETCD_ENDPOINT
              value: etcd:2379
            - name: AMQP_URL
              value: amqp://rabbitmq:5672?heartbeat=5s
            - name: CONTROL_SERVICE_SENTRY_DSN
              value: https://c4698982912c457ba9c9a2a815a8bb25@o359550.ingest.sentry.io/5479806
            - name: WORKER_IMAGE_TAG
              value: ${DOCKER_TAG}
            - name: TURNSTILE_SECRET_KEY
              value: "${TURNSTILE_SECRET_KEY}"
          image: ghcr.io/mxschmitt/try-playwright/control-service:${DOCKER_TAG}
          name: control
          imagePullPolicy: IfNotPresent
      restartPolicy: Always
