apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    io.kompose.service: rustfs
  name: rustfs
spec:
  replicas: 1
  selector:
    matchLabels:
      io.kompose.service: rustfs
  strategy:
    type: Recreate
  template:
    metadata:
      labels:
        io.kompose.service: rustfs
    spec:
      securityContext:
        fsGroup: 10001
        runAsUser: 10001
        runAsGroup: 10001
      containers:
        - args:
            - /data
          image: rustfs/rustfs:1.0.0-rc.5
          name: rustfs
          env:
            - name: RUSTFS_ACCESS_KEY
              value: "${RUSTFS_ACCESS_KEY}"
            - name: RUSTFS_SECRET_KEY
              value: "${RUSTFS_SECRET_KEY}"
            - name: RUSTFS_ADDRESS
              value: ":9000"
            - name: RUSTFS_CONSOLE_ENABLE
              value: "false"
            - name: RUSTFS_VOLUMES
              value: /data
            - name: RUSTFS_OBS_LOGGER_LEVEL
              value: error
            - name: RUSTFS_OBS_LOG_DIRECTORY
              value: /var/log/rustfs/
          ports:
            - name: s3
              containerPort: 9000
          volumeMounts:
            - name: data
              mountPath: /data
            - name: logs
              mountPath: /var/log/rustfs
          livenessProbe:
            httpGet:
              path: /health
              port: s3
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: s3
            initialDelaySeconds: 5
            periodSeconds: 5
      volumes:
        - name: data
          emptyDir: {}
        - name: logs
          emptyDir: {}
      restartPolicy: Always
