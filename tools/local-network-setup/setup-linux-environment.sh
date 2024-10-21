#!/bin/bash
pathToOtNode=$(pwd)
numberOfNodes=12
network="hardhat1:31337"
tripleStore="ot-neptune"
availableNetworks=("hardhat1:31337")
export $(xargs < $pathToOtNode/.env)
export ACCESS_KEY=$RPC_ENDPOINT
# Check for script arguments
while [ $# -gt 0 ]; do
  case "$1" in
  	# Override number of nodes if the argument is specified
    --nodes=*)
      numberOfNodes="${1#*=}"
      if [[ $numberOfNodes -le 0 ]]
      then
        echo Cannot run 0 nodes
        exit 1
      fi
      ;;
    # Print script usage if --help is given
    --help)
      echo "Use --nodes=<insert_number_here> to specify the number of nodes to generate"
      echo "Use --network=<insert_network_name> to specify the network to connect to. Available networks: hardhat."
      exit 0
      ;;
    --network=*)
      network="${1#*=}"
      if [[ ! " ${availableNetworks[@]} " =~ " ${network} " ]]
      then
          echo Invalid network parameter. Available networks: hardhat
          exit 1
      fi
      ;;
    --tripleStore=*)
      tripleStore="${1#*=}"
      ;;
    *)
      printf "***************************\n"
      printf "* Error: Invalid argument.*\n"
      printf "***************************\n"
      exit 1
  esac
  shift
done
if [[ $network == hardhat1:31337 ]]
then
  echo ================================
  echo ====== Starting hardhat1 ======
  echo ================================
  sh -c "cd $pathToOtNode && node tools/local-network-setup/run-local-blockchain.js 8545 :v2" &
  echo Waiting for hardhat to start and contracts deployment

  echo ================================
  echo ====== Starting hardhat 2 ======
  echo ================================
  sh -c "cd $pathToOtNode && node tools/local-network-setup/run-local-blockchain.js 9545 :v2" &
  echo Waiting for hardhat to start and contracts deployment
fi

echo ================================
echo ====== Generating configs ======
echo ================================

node $pathToOtNode/tools/local-network-setup/generate-config-files.js $numberOfNodes $network $tripleStore $hubContractAddress
sleep 5
echo ================================
echo ======== Starting nodes ========
echo ================================

startNode() {
  echo Starting node $1
  sh -c "cd $pathToOtNode && node index.js ./tools/local-network-setup/.node$1_origintrail_noderc.json" &
}

i=0
while [[ $i -lt $numberOfNodes ]]
do
  startNode $i
  ((i = i + 1))
done

wait
# Close started background processes when done (https://stackoverflow.com/a/2173421)
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT