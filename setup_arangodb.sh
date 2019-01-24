#!/bin/bash

export DEBIAN_FRONTEND=noninteractive
export ARANGODB_DEFAULT_ROOT_PASSWORD=root

echo arangodb3 arangodb/password password root | sudo debconf-set-selections  # set username 'root'
echo arangodb3 arangodb/password_again password root | sudo debconf-set-selections  # set password 'root'
curl -OL https://download.arangodb.com/arangodb34/DEBIAN/Release.key
sudo apt-key add - < Release.key
echo 'deb https://download.arangodb.com/arangodb34/DEBIAN/ /' | sudo tee /etc/apt/sources.list.d/arangodb.list
sudo apt-get install apt-transport-https
sudo apt-get update
sudo apt-get install arangodb3=3.4.1-1
sudo sed -i 's/authentication = true/authentication = false/g' /etc/arangodb3/arangod.conf
sudo arango-secure-installation
sudo systemctl start arangodb3

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

curl -H 'Authorization:Basic cm9vdDo=' -s http://127.0.0.1:8529/_api/version

echo "ArangoDB is up"
