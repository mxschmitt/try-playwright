apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    io.kompose.service: minio
  name: minio
spec:
  replicas: 1
  selector:
    matchLabels:
      io.kompose.service: minio
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        io.kompose.service: minio
    spec:
      containers:
        - args:
            - server
            - /data
          image: minio/minio
          name: minio
          env:
            - name: MINIO_ROOT_USER
              value: "${MINIO_ROOT_USER}"
            - name: MINIO_ROOT_PASSWORD
              value: "${MINIO_ROOT_PASSWORD}"
      restartPolicy: Always
