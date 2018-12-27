#!/bin/bash

set -ev

docker logs mynode
docker stop mynode
docker rm mynode
docker rmi myimage:latest