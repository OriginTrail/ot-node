#!bin/bash
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs

wget https://www.arangodb.com/repositories/arangodb3/xUbuntu_16.04/Release.key
sudo apt-key add Release.key
sudo apt-add-repository 'deb https://www.arangodb.com/repositories/arangodb3/xUbuntu_16.04/ /'
sudo apt-get update -y
sudo apt-get install arangodb3

sudo apt-get install -y python3-pip

pip3 install python-arango
pip3 install xmljson
pip install python-dotenv

git clone https://github.com/OriginTrail/ot-node.git
cd ot-node
cp .env.example .env