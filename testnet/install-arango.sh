#!bin/bash
wget https://www.arangodb.com/repositories/arangodb3/xUbuntu_16.04/Release.key
apt-key add Release.key
apt-add-repository 'deb https://www.arangodb.com/repositories/arangodb3/xUbuntu_16.04/ /'
apt-get update -y
echo arangodb3 arangodb3/password password root | debconf-set-selections
echo arangodb3 arangodb3/password_again password root | debconf-set-selections
apt-get install arangodb3 -y --allow-unauthenticated