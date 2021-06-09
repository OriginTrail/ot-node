#!/bin/bash
function printUsage {
	echo ""
	echo "Usage:"
	echo "    restore.sh [--backupDir=<backup_directory_path>] [--configDir=<config_directory_path>]"
	echo "Options:"
	echo "    --backupDir=<backup_directory_path>\
	Specify the path to the folder containing the backup data on your device. Defaults to the folder with the most recent timestamp inside the backup/ directory"
	echo "    --backupDir=<config_directory_path>
	Specify the path to the folder inside the docker container where configuration files are stored. Defaults to /ot-node/data/"
	echo ""
}

BACKUPDIR="none"
CONFIGDIR="none"
CONTAINER_NAME="otnode"

for i in "$@"
do
case $i in
    -h|--help=*)
	printUsage
	exit 0
	# past argument=value
    ;;
    --configDir=*)
    CONFIGDIR="${i#*=}"
    shift # past argument=value
    ;;
    --backupDir=*)
    BACKUPDIR="${i#*=}"
    shift # past argument with no value
    ;;
    --containerName=*)
    CONTAINER_NAME="${i#*=}"
    shift # past argument with no value
    ;;
    *)
     echo "Unknown option detected ${i}"
     printUsage
     exit 2
    ;;
esac
done


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

temp_folder=temp_ot_node_files_8092
mkdir $temp_folder

for file in `ls ${BACKUPDIR}`; do
    if [ ! ${file}] == "arangodb" ]
    then
      sourcePath="${BACKUPDIR}/${file}"
      destinationPath="${CONTAINER_NAME}:${CONFIGDIR}/"

      echo "cp ${sourcePath} ${temp_folder}"
      cp ${sourcePath} ${temp_folder}/

      sourcePath=./${temp_folder}/${file}
      echo "docker cp ${sourcePath} ${destinationPath}"
      docker cp ${sourcePath} ${destinationPath}
    fi
done

sourcePath="${BACKUPDIR}/.origintrail_noderc"
destinationPath="${CONTAINER_NAME}:/ot-node/current/"

echo "cp ${sourcePath} ${temp_folder}"
cp ${sourcePath} ${temp_folder}/
sourcePath=./${temp_folder}/.origintrail_noderc

echo "docker cp ${sourcePath} ${destinationPath}"
docker cp ${sourcePath} ${destinationPath}

identitiesDir="${BACKUPDIR}/identities"
if [ -d ${identitiesDir} ]
then
  sourcePath="${BACKUPDIR}/identities"
  destinationPath="${CONTAINER_NAME}:${CONFIGDIR}/"

  echo "cp -r ${sourcePath} ${temp_folder}/"
  cp -r ${sourcePath} ${temp_folder}/

  sourcePath=./${temp_folder}/identities
  echo "docker cp ${sourcePath} ${destinationPath}"
  docker cp ${sourcePath} ${destinationPath}
fi

certFiles=(fullchain.pub privkey.pem)
if [ -e "${BACKUPDIR}/fullchain.pem" ] && [ -e "${BACKUPDIR}/privkey.pem" ]
then
	echo "mkdir ${temp_folder}/certs"
	mkdir ${temp_folder}/certs

	echo "cp ${BACKUPDIR}/fullchain.pem ./${temp_folder}/certs/"
	cp ${BACKUPDIR}/fullchain.pem ./${temp_folder}/certs

	echo "cp ${BACKUPDIR}/privkey.pem ./${temp_folder}/certs/"
	cp ${BACKUPDIR}/privkey.pem ./${temp_folder}/certs

	echo "docker cp ${temp_folder}/certs ${CONTAINER_NAME}:/ot-node/"
	docker cp ${temp_folder}/certs otnode:/ot-node/
else
	echo "Cert files do not exits, skipping..."
fi

migrationDir="${BACKUPDIR}/migrations"
if [ -d ${migrationDir} ]
then
  sourcePath="${BACKUPDIR}/migrations"
  destinationPath="${CONTAINER_NAME}:${CONFIGDIR}/"

  echo "cp -r ${sourcePath} ${temp_folder}/"
  cp -r ${sourcePath} ${temp_folder}/

  sourcePath=./${temp_folder}/migrations
  echo "docker cp ${sourcePath} ${destinationPath}"
  docker cp ${sourcePath} ${destinationPath}
fi

echo docker cp ${CONTAINER_NAME}:/ot-node/current/config/config.json ./
docker cp ${CONTAINER_NAME}:/ot-node/current/config/config.json ./

rm config.json

echo "cp -r ${BACKUPDIR}/arangodb ${temp_folder}/"
cp -r ${BACKUPDIR}/arangodb ${temp_folder}/

databaseName=$(cat ${BACKUPDIR}/arangodb/database.txt)
echo "database name ${databaseName}"

databaseUsername=$(cat ${BACKUPDIR}/arangodb/username.txt)
echo "database username ${databaseUsername}"

echo "docker cp ${temp_folder}/arangodb ${CONTAINER_NAME}:${CONFIGDIR}/"
docker cp "${temp_folder}/arangodb" ${CONTAINER_NAME}:${CONFIGDIR}/


echo rm -rf ${temp_folder}
rm -rf ${temp_folder}

echo docker start ${CONTAINER_NAME}
docker start ${CONTAINER_NAME}

echo sleep 30
sleep 30

docker cp ${CONTAINER_NAME}:${CONFIGDIR}/arango.txt arango.txt
databasePassword=$(cat arango.txt)
rm arango.txt

echo "docker exec ${CONTAINER_NAME} arangorestore --server.database ${databaseName} --server.username ${databaseUsername} --server.password \"${databasePassword}\" --input-directory ${CONFIGDIR}/arangodb/ --overwrite true"
docker exec ${CONTAINER_NAME} arangorestore --server.database ${databaseName} --server.username ${databaseUsername} --server.password "${databasePassword}" --input-directory ${CONFIGDIR}/arangodb/ --overwrite true

echo docker restart ${CONTAINER_NAME}
docker restart ${CONTAINER_NAME}

echo docker exec ${CONTAINER_NAME} rm -rf ${CONFIGDIR}/arangodb
docker exec ${CONTAINER_NAME} rm -rf ${CONFIGDIR}/arangodb


