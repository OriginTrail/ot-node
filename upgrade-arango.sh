#!/bin/bash
service arangodb3 stop
rm -rf /var/lib/arangodb3/LOCK
rm -rf /var/lib/arangodb3/rocksdb/LOCK
update-rc.d -f arangodb3 remove

dpkg --purge arangodb3

curl -OL https://download.arangodb.com/arangodb35/DEBIAN/Release.key
apt-key add - < Release.key

echo 'deb https://download.arangodb.com/arangodb35/DEBIAN/ /' | tee /etc/apt/sources.list.d/arangodb.list
apt-get install apt-transport-https -y
apt-get update -y

echo arangodb3 arangodb3/password password "$1" | debconf-set-selections
echo arangodb3 arangodb3/password_again password "$1" | debconf-set-selections
echo arangodb3 arangodb3/upgrade boolean false | debconf-set-selections
echo arangodb3 arangodb3/storage_engine select auto | debconf-set-selections
apt-get install arangodb3=3.5.3-1 -y --allow-unauthenticated

sed -i 's/authentication = true/authentication = false/g' /etc/arangodb3/arangod.conf

ps aux | grep -ie arangod | awk '{print $2}' | xargs kill -9

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
