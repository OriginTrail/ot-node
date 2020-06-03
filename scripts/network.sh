#!/bin/bash
#######################################
START_TIME=$SECONDS
## Update packages and Upgrade system
sudo apt-get update -y
sudo apt-get install npm -y
sudo curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g ganache-cli
sudo npm install sqlite3

## Git ##
echo '###Installing Git..'
sudo apt-get install git -y

# Git Configuration
echo '###Congigure Git..'

git config --global user.name Milos Kotlar
git config --global user.email kotlarmilos@gmail.com

echo 'Git has been configured!'
git config --list

mkdir release-ot-node
mkdir develop-ot-node

cd release-ot-node

git clone https://github.com/OriginTrail/ot-node.git

cd ot-node/

git checkout release/testnet

npm install

./setup_arangodb.sh

cd ../../


cd develop-ot-node

git clone https://github.com/OriginTrail/ot-node.git

cd ot-node/

npm install

cd ../../

git clone https://kotlarmilos:lepaK07%21github@github.com/OriginTrail/utilities.git

cd utilities/

git checkout feature/remote-network-setup

cd NodeGenerator/

npm install

./create-config-files.sh --holders=10

./setup-network.sh --holders=5

./setup-old-network.sh --holders=10


sleep 20

ELAPSED_TIME=$(($SECONDS - $START_TIME))

echo $ELAPSED_TIME