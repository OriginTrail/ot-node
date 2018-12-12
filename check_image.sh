#!/bin/bash

set -ev

docker ps -a
docker build --file ./Dockerfile.development -t myimage:latest .
docker images
docker run -d --name=mynode -p 8900:8900 -p 5278:5278 -p 3000:3000 -v $PWD/.origintrail_noderc.image:/ot-node/.origintrail_noderc myimage:latest
sleep 540
# docker exec mynode /bin/sh -c "ls logs/"
# docker exec mynode /bin/sh -c "cat logs/*.log"
docker exec mynode /bin/sh -c "curl -X POST http://127.0.0.1:8900/api/import -F importtype=GS1 -F importfile=@/ot-node/importers/xml_examples/Retail/03_Pink_to_Orange_shipment.xml -F replicate=true" > importResult.json
cat importResult.json
# TODO assert that import result has two keys, data_set_is and replication_id