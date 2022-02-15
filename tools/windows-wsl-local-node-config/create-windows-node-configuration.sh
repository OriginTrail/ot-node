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

# get host IP for use in configuration
hostIp=$(cat /etc/resolv.conf | grep 'nameserver' | cut -d ' ' -f 2)

node $pathToOtNode/tools/windows-wsl-local-node-config/generate-config-files-windows-wsl.js $numberOfNodes $hostIp

echo ================================
echo ======== Config Created ========
echo ================================