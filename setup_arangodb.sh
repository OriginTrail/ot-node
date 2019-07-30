#!/bin/bash

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

sed -i 's/authentication = true/authentication = false/g' /etc/arangodb3/arangod.conf
systemctl start arangodb3

echo "Waiting until ArangoDB is ready on port 8529"

n=0
# timeout value for startup
timeout=60 
while [[ (-z `curl -H 'Authorization: Basic cm9vdDo=' -s 'http://127.0.0.1:8529/_api/version' `) && (n -lt timeout) ]] ; do
  echo -n "."
  sleep 1s
  n=$[$n+1]
done

if [[ n -eq timeout ]];
then
    echo "Could not start ArangoDB. Timeout reached."
    exit 1
fi

echo "ArangoDB is up"
