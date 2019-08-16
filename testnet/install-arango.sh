#!bin/bash
curl -OL https://download.arangodb.com/arangodb33/xUbuntu_16.04/Release.key
apt-key add - < Release.key
echo 'deb https://download.arangodb.com/arangodb33/xUbuntu_16.04/ /' | tee /etc/apt/sources.list.d/arangodb.list
apt-get install apt-transport-https -y
apt-get update -y
echo arangodb3 arangodb3/backup boolean false | debconf-set-selections
echo arangodb3 arangodb3/upgrade boolean true | debconf-set-selections
echo arangodb3 arangodb3/storage_engine select mmfiles | debconf-set-selections
echo arangodb3 arangodb3/password password root | debconf-set-selections
echo arangodb3 arangodb3/password_again password root | debconf-set-selections
apt-get install arangodb3=3.3.12 -y --allow-unauthenticated