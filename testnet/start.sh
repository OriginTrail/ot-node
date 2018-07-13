#!/usr/bin/env bash
cd /
wget https://raw.githubusercontent.com/origintrail/ot-node/docker/testnet/register-node.js -q
rm /ot-node/testnet/register-node.js
mv /register-node.js /ot-node/testnet/register-node.js
cd /ot-node
/usr/bin/supervisord