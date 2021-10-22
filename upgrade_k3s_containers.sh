#!/bin/bash

set -e

OLD_IMG=$(k3s crictl img | grep "try-playwright" | awk '{print $3}' | tr '\r\n' ' ')

k3s crictl rmi $OLD_IMG

kubectl delete pod -l io.kompose.service=frontend
kubectl delete pod -l io.kompose.service=control
