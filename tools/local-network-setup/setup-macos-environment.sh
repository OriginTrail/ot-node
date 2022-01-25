#!/bin/sh
pathToOtNode=$(pwd)
numberOfNodes=4

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
      exit 0
      ;;
    *)
      printf "***************************\n"
      printf "* Error: Invalid argument.*\n"
      printf "***************************\n"
      exit 1
  esac
  shift
done

echo ================================
echo ====== Generating configs ======
echo ================================

node $pathToOtNode/tools/local-network-setup/generate-config-files.js $numberOfNodes

echo ================================
echo ======== Starting nodes ========
echo ================================

startNode() {
  echo Starting node $1
  osascript -e "tell app \"Terminal\"
      do script \"cd $pathToOtNode
  node index.js ./tools/local-network-setup/.$1_origintrail_noderc\"
  end tell"
}

startNode bootstrap

# Start only DC node and exit
if [[ $numberOfNodes -ne 1 ]]
then
  i=1
  while [[ $i -lt $numberOfNodes ]]
  do
    startNode dh$i
    ((i = i + 1))
  done
fi
