#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

VERSION=3.2.2
NAME=ArangoDB-$VERSION

if [ ! -d "$DIR/$NAME" ]; then
  # download ArangoDB
  echo "curl -L -o $NAME.tar.gz https://www.arangodb.org/repositories/travisCI/$NAME.tar.gz"
  curl -L -o $NAME.tar.gz https://www.arangodb.org/repositories/travisCI/$NAME.tar.gz
  echo "tar zxf $NAME.tar.gz"
  tar zvxf $NAME.tar.gz
fi

ARCH=$(arch)
PID=$(echo $PPID)
TMP_DIR="/tmp/arangodb.$PID"
PID_FILE="/tmp/arangodb.$PID.pid"
ARANGODB_DIR="$DIR/$NAME"
ARANGOD="${ARANGODB_DIR}/bin/arangod_x86_64"

# create database directory
mkdir ${TMP_DIR}

echo "Starting ArangoDB '${ARANGOD}'"

${ARANGOD} \
    --database.directory ${TMP_DIR} \
    --configuration none \
    --server.endpoint tcp://127.0.0.1:8529 \
    --javascript.app-path ${ARANGODB_DIR}/js/apps \
    --javascript.startup-directory ${ARANGODB_DIR}/js \
    --database.maximal-journal-size 1048576 \
    --server.authentication false &

sleep 2

echo "Check for arangod process"
process=$(ps auxww | grep "bin/arangod" | grep -v grep)

if [ "x$process" == "x" ]; then
  echo "no 'arangod' process found"
  echo "ARCH = $ARCH"
  exit 1
fi

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
