#!bin/bash
curl -OL https://download.arangodb.com/arangodb35/DEBIAN/Release.key
apt-key add - < Release.key

echo 'deb https://download.arangodb.com/arangodb35/DEBIAN/ /' | tee /etc/apt/sources.list.d/arangodb.list
apt-get install apt-transport-https -y
apt-get update -y

mkdir -p /ot-node/data
touch /ot-node/data/arango.txt
arango_password=$(openssl rand -base64 128)
echo $arango_password > /ot-node/data/arango.txt

echo arangodb3 arangodb3/password password $arango_password | debconf-set-selections
echo arangodb3 arangodb3/password_again password $arango_password | debconf-set-selections
echo arangodb3 arangodb3/upgrade boolean false | debconf-set-selections
echo arangodb3 arangodb3/storage_engine select auto | debconf-set-selections
apt-get install arangodb3=3.5.3-1 -y --allow-unauthenticated
sed -i 's/authentication = true/authentication = false/g' /etc/arangodb3/arangod.conf
sed -i 's/endpoint = tcp:\/\/127.0.0.1:8529/endpoint = tcp:\/\/0.0.0.0:8529/g' /etc/arangodb3/arangod.conf

arango_password=""
