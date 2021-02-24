function printUsage() {
    echo ""
    echo "Usage:"
    echo "    migrate_to_v5.sh [--node_rc_path=<path_to_node_rc_configuration_file>] [--node_container_name=<node_docker_container_name>]"
    echo "Options:"
    echo "    --node_rc_path=<path_to_node_rc_configuration_file>
	Specify the path to the node rc configuration file. If node_rc_path option is not passed default one will be used: .origintrail_noderc"
    echo "    --node_container_name=<node_docker_container_name>
	Specify the name of docker container running ot-node. If node_container_name option is not passed default one will be used: otnode"
    echo ""
}

NODE_RC_PATH=".origintrail_noderc"
DOCKER_CONTAINER_NAME="otnode"

while [ $# -gt 0 ]; do
    case "$1" in
    -h | --help)
        printUsage
        exit 0
        ;;
    --node_rc_path=*)
        NODE_RC_PATH="${1#*=}"
        ;;
    --node_container_name=*)
        DOCKER_CONTAINER_NAME="${1#*=}"
        ;;
    esac
    shift
done

if [ ! -f "$NODE_RC_PATH" ]; then
    echo "$NODE_RC_PATH does not exist. Please check file path provided. Use -h for help."
    exit 0
fi

if [ ! "$(docker ps -a --filter status=running | grep $DOCKER_CONTAINER_NAME)" ]; then
    echo "Docker container with name: $DOCKER_CONTAINER_NAME, not running or doesn't exists. Use -h for help."
    exit 0
fi

echo "Generating new version 5 configuration."
docker exec otnode node /ot-node/current/scripts/generate_v5_configuration.js
echo "Version 5 configuration generated."
docker mv ${NODE_RC_PATH} origintrail_noderc_v4_backup
echo "Old configuration saved as .origintrail_noderc_v4_backup."
docker cp otnode:/ot-node/data/.v5_configuration ./${NODE_RC_PATH}
echo "Starting manual node update to version 5. Please be patient this can take up to 10 minutes."
docker exec otnode node /ot-node/current/scripts/start_v5_update.js
echo "Manual update finalized. Restarting otnode node..."
docker restart ${DOCKER_CONTAINER_NAME}
echo "Update completed successfully!"
