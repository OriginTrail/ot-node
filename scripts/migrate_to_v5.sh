#!bin/bash
docker exec otnode node /ot-node/current/scripts/generate_v5_configuration.js
docker mv origintrail_noderc origintrail_noderc_v4_backup
docker cp otnode:/ot-node/data/.v5_configuration ./origintrail_noderc
docker exec otnode node /ot-node/current/scripts/start_v5_update.js
docker restart otnode
