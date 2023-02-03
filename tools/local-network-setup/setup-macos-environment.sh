#!/bin/sh
pathToOtNode=$(pwd)
numberOfNodes=4
network="ganache"
tripleStore="ot-graphdb"
availableNetworks=("ganache" "rinkeby")
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
      echo "Use --network=<insert_network_name> to specify the network to connect to. Available networks: ganache, rinkeby. Default: ganache"
      exit 0
      ;;
    --network=*)
      network="${1#*=}"
      if [[ ! " ${availableNetworks[@]} " =~ " ${network} " ]]
      then
          echo Invalid network parameter. Available networks: ganache, rinkeby
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
if [[ $network == ganache ]]
then
  echo ================================
  echo ====== Starting ganache ======
  echo ================================

  osascript -e "tell app \"Terminal\"
        do script \"cd $pathToOtNode
        node tools/local-network-setup/run-local-blockchain.js\"
    end tell"
fi

if [[ $network == rinkeby ]]
then

  echo ============================================
  echo ====== Deploying contracts on rinkeby ======
  echo ============================================

  hubContractAddress=`npm explore dkg-evm-module -- npm run deploy:rinkeby 2>&1 | awk '/Hub address:/ {print $3}'`
  echo Using hub contract address: $hubContractAddress
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
  osascript -e "tell app \"Terminal\"
      do script \"cd $pathToOtNode
  node index.js ./tools/local-network-setup/.node$1_origintrail_noderc.json\"
  end tell"
}

i=0
while [[ $i -lt $numberOfNodes ]]
do
  startNode $i
  ((i = i + 1))
done
