#!/bin/bash
function printUsage {
	echo ""
	echo "Usage:"
	echo "    restore.sh [--environment=(mainnet|testnet|development)] [--backupDir=<backup_directory_path>] [--configDir=<config_directory_path>]"
	echo "Options:"
	echo "    --environment=(mainnet|testnet|development)
	Specify which environment default parameters are to be used. Defaults to mainnet"
	echo "    --backupDir=<backup_directory_path>\
	Specify the path to the folder containing the backup data on your device. Defaults to the folder with the most recent timestamp inside the backup/ directory"
	echo "    --backupDir=<config_directory_path>
	Specify the path to the folder inside the docker container where configuration files are stored. Defaults to /ot-node/data/"
	echo ""
}

ENVIRONMENT="mainnet"
BACKUPDIR="none"
CONFIGDIR="none"

for i in "$@"
do
case $i in
    -h|--help=*)
	printUsage
	exit 0
	# past argument=value
    ;;
    -e=*|--environment=*)
    ENVIRONMENT="${i#*=}"
    echo "Environment is ${ENVIRONMENT}"
    shift
    ;;
    --configDir=*)
    CONFIGDIR="${i#*=}"
    shift # past argument=value
    ;;
    --backupDir=*)
    BACKUPDIR="${i#*=}"
    shift # past argument with no value
    ;;
    *)
     echo "Unknown option detected ${i}"
     printUsage
     exit 2
    ;;
esac
done

# Load environment
if [ ${ENVIRONMENT} == "mainnet" ]
then
	environmentIndex=2
elif [ ${ENVIRONMENT} == "testnet" ]
then
	environmentIndex=1
elif [ ${ENVIRONMENT} == "development" ]
then
	environmentIndex=0
else
	echo "Environment ${ENVIRONMENT} is not supported"
	printUsage
	exit 1
fi

# Load backup directory path
if [ ${BACKUPDIR} == "none" ] 
then
	echo "No backup directory specified, loading last backup from ./backup folder"
	echo ""
	# Find the latest backup file
	dateExpression=[1-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T
	allBackups=($(ls -dr backup/* | grep "$backup/$dateExpression"))
	latestBackupDir=${allBackups[@]:0:1}
	BACKUPDIR=${latestBackupDir}
fi
if [ -d ${BACKUPDIR} ]
then
	echo "Using ${BACKUPDIR} as the backup directory"
	echo ""
else
	echo "Given backup directory parameter ${BACKUPDIR} is not a directory!"
	printUsage
	exit 1
fi

# Load config directory path
if [ ${CONFIGDIR} == "none" ] 
then
	echo "No config directory specified, using /ot-node/data as default"
	echo ""
	CONFIGDIR="/ot-node/data"
else
	echo "Using ${CONFIGDIR} as the data directory"
	echo ""
fi

configFiles=(erc725_identity.json houston.txt identity.json kademlia.crt kademlia.key system.db)

for file in ${configFiles[@]}; do
  sourcePath="${BACKUPDIR}/${file}"
  destinationPath="otnode:${CONFIGDIR}/"

  echo "docker cp ${sourcePath} ${destinationPath}"
done

sourcePath="${BACKUPDIR}/.origintrail_noderc"
destinationPath="otnode:/ot-node/current/"
echo "docker cp ${sourcePath} ${destinationPath}"

certFiles=(fullchain.pub privkey.pem)

if [ -e fullchain.pub ] && [ -e privkey.pem ]
then
	echo "mkdir ${BACKUPDIR}/certs"
	echo "docker cp ${BACKUPDIR}/certs otnode:/ot-node/"
fi

docker cp otnode:/ot-node/current/config/config.json ./
# cp ~/ot-node/config/config.json ./

databaseName=($(cat config.json | grep "\"database\": \"" | sed -r "s_([[:blank:]]+)\"database\":[[:blank:]]\"__" | sed "s/\",$//"))
databaseName=${databaseName[@]:${environmentIndex}:1}

echo "database name ${databaseName}"

databaseUsername=($(cat config.json | grep "\"username\": \"" | sed -r "s_([[:blank:]]+)\"username\":[[:blank:]]\"__" | sed "s/\",$//"))
databaseUsername=${databaseUsername[@]:${environmentIndex}:1}

echo "database username ${databaseUsername}"

databasePassword=($(cat config.json | grep "\"password\": \"" | sed -r "s_([[:blank:]]+)\"password\":[[:blank:]]\"__" | sed "s/\",$//"))
databasePassword=${databasePassword[@]:${environmentIndex}:1}

echo "database password ${databasePassword}"

rm config.json

echo "docker cp ${BACKUPDIR}/arangodb otnode:${CONFIGDIR}/"
echo docker start otnode
sleep 5
echo "docker exec otnode arangorestore --server.database ${databaseName} --server.username ${databaseUsername} --server.password ${databasePassword} --input-directory ${CONFIGDIR}/arangodb/ --overwrite true"
echo docker restart otnode

