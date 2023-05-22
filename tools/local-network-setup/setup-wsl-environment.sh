!/bin/bash

pathToOtNode=$(pwd)
ubuntuVersion="ubuntu2204"
availableNetworks=("hardhat")
network="hardhat"
tripleStore="ot-blazegraph"
numberOfNodes=4

export $(xargs < $pathToOtNode/.env)
export ACCESS_KEY=$RPC_ENDPOINT

# Check for script arguments
while [ $# -gt 0 ]; do
    case "$1" in
        # Print script usage if --help is given
        --help)
            echo "Use --ubuntuVersion=<insert_ubuntu_version_here> to specify the ubuntu version to run. Default: ubuntu2204"
            echo "Use --network=<insert_network_name> to specify the network to connect to. Available networks: hardhat, rinkeby. Default: hardhat"
            echo "Use --tripleStore=<name> - Specify the name of the triple store. Default: ot-blazegraph"
            echo "Use --nodes=<insert_number_here> to specify the number of nodes to generate"
            exit 0
            ;;
        --ubuntuVersion=*)
            ubuntuVersion="${1#*=}"
            ;;
        --network=*)
            network="${1#*=}"
            if [[ ! " ${availableNetworks[@]} " =~ " ${network} " ]]; then
                echo Invalid network parameter. Available networks: hardhat
                exit 1
            fi
            ;;
        --tripleStore=*)
            tripleStore="${1#*=}"
            ;;
        # Override number of nodes if the argument is specified
        --nodes=*)
            numberOfNodes="${1#*=}"
            if [[ $numberOfNodes -le 0 ]]; then
                echo Cannot run 0 nodes
                exit 1
            fi
            ;;
        *)
            printf "***************************\n"
            printf "* Error: Invalid argument.*\n"
            printf "***************************\n"
            exit 1
            ;;
    esac
    shift
done

if [[ $network == hardhat ]]; then
    echo ================================
    echo ====== Starting hardhat ======
    echo ================================
    cmd.exe /c start $ubuntuVersion run "cd $pathToOtNode && node tools/local-network-setup/run-local-blockchain.js" &
    echo Waiting for hardhat to start and contracts deployment
fi

echo ================================
echo ====== Generating configs ======
echo ================================
node $pathToOtNode/tools/local-network-setup/generate-config-files.js $numberOfNodes $network $tripleStore $hubContractAddress

echo ================================
echo ======== Starting nodes ========
echo ================================
startNode() {
    echo Starting node $1
    cmd.exe /C start $ubuntuVersion run "cd $pathToOtNode && node index.js ./tools/local-network-setup/.node$1_origintrail_noderc.json" &
}

i=0
while [[ $i -lt $numberOfNodes ]]; do
    startNode $i
    ((i = i + 1))
done
