#!/bin/bash

set -ev

docker ps -a
docker images
pwd
ls -al
docker build --file ./Dockerfile.development -t myimage:latest .
docker run -d --name=mynode -p 8900:8900 -p 5278:5278 -p 3000:3000 -v $PWD/.origintrail_noderc.travis:/ot-node/.origintrail_noderc myimage:latest
# docker run -d --name=mynode -p 8900:8900 -p 5278:5278 -p 3000:3000 -v /Users/sebek/Documents/GitHub/ot-node/.origintrail_noderc.travis:/ot-node/.origintrail_noderc origintrail/ot-node:latest
sleep 600
docker exec mynode /bin/sh -c "curl -X POST http://127.0.0.1:8900/api/import -F importtype=GS1 -F importfile=@/ot-node/importers/xml_examples/Retail/03_Pink_to_Orange_shipment.xml -F replicate=true" > importResult.json
cat importResult.json
docker stop mynode
docker rm mynode
