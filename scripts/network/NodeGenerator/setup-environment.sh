#!/bin/sh
echo ==============================
echo ====== Starting ganache ======
echo ==============================

#osascript -e 'tell app "Terminal"
#    do script "ganache-cli -i 5777 -a 100 -p 7545 -l 10000000 -m \"aspect ask story desert profit engage tuition leave fade giraffe exclude brief\" "
#end tell'

echo ===============================
echo ===== Deploying contracts =====
echo ===============================

screen -d -m -S ganache bash -c 'ganache-cli -i 5777 -a 1000 -p 7545 -l 10000000 -m "aspect ask story desert profit engage tuition leave fade giraffe exclude brief"'

cd ../../../modules/Blockchain/Ethereum
../../../node_modules/.bin/truffle migrate --network ganache
cd ../../../scripts/network/NodeGenerator

echo ================================
echo ======= Setting up nodes =======
echo ================================

node ./generate.js

echo ================================
echo ======== Starting nodes ========
echo ================================

#osascript -e 'tell app "Terminal"
#    do script "cd ot-node && npm start -- --configDir=../config-files/DCG-config --config=../config-files/DCG.json"
#end tell'
#
#sleep 20
#
#for i in {1..3}
#do
#osascript -e 'tell app "Terminal"
#    do script "cd ot-node && npm start -- --configDir=../config-files/DHG'"$i"'-config --config=../config-files/DHG'"$i"'.json"
#end tell'
#done

#  osascript -e 'tell app "Terminal"
#     do script "cd ot-node && npm start -- --configDir=../config-files/DHG'+i+'-config --config=../config-files/DHG'+i+'.json"
# end tell'

# osascript -e 'tell app "Terminal"
#     do script "cd ot-node && npm start -- --configDir=../config-files/DHG2-config --config=../config-files/DHG2.json"
# end tell'

# osascript -e 'tell app "Terminal"
#     do script "cd ot-node && npm start -- --configDir=../config-files/DHG3-config --config=../config-files/DHG3.json"
# end tell'