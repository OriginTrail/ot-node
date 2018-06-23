#!/usr/bin/env bash
wget https://raw.githubusercontent.com/origintrail/ot-node/docker/testnet/register-node.js -q
rm register-node.js
mv register-node.js /ot-node/register-node.js
/usr/bin/supervisord