#!/bin/bash

OS_VERSION=$(lsb_release -sr)
GRAPHDB_FILE="/root/graphdb-free-9.10.1-dist.zip"
OTNODE_DIR="/root/ot-node"
N1=$'\n'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear

echo "Installing the latest OriginTrail V6 Beta!"
echo "This is a community installer. For support please visit the Communtiy Node Support Telegram group at https://t.me/otnodegroup."
echo "Origintrail will NOT be able to support this installer."
echo " "
read -p "Press enter to acknowedge this and continue..."

echo -n "${N1}Checking that the OS is Ubuntu 20.04 ONLY: "

if [[ $OS_VERSION != 20.04 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "This installer requires Ubuntu 20.04. Destroy this VPS and remake using Ubuntu 20.04."
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Checking that we are in /root directory: "

if [ $PWD != "$OTNODE_DIR" ]; then
    echo -e "${RED}FAILED${NC}"
    echo "${N1}This installer requires the user to be logged in as root (NOT a regular user using sudo) and in the root directory. Npm install will fail if using sudo.${N1}"
    exit
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Checking that the GraphDB file is present in /root: "

if [[ ! -f $GRAPHDB_FILE ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "The graphdb file needs to be downloaded to /root. Please create an account at https://www.ontotext.com/products/graphdb/graphdb-free/ and click the standalone version link in the email."
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

# Switch to /root
cd

echo -n "Updating Ubuntu package repository: "

OUTPUT=$(apt update >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error updating the Ubuntu repo."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Updating Ubuntu to latest version (may take a few minutes): "

OUTPUT=$(apt upgrade -y >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo -n "There was an error updating Ubuntu to the latest version."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing default-jre: "

OUTPUT=$(apt install default-jre unzip jq -y >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing default-jre."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Unzipping GraphDB: "
OUTPUT=$(unzip -o $GRAPHDB_FILE >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error unzipping GraphDB."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Copying service file: "

OUTPUT=$(cp $OTNODE_DIR/installer/data/graphdb.service /lib/systemd/system/ >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error copying the service file."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

systemctl daemon-reload

echo -n "Starting GraphDB: "

OUTPUT=$(systemctl start graphdb >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error starting GraphDB."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Confirming GraphDB has started: "

IS_RUNNING=$(systemctl show -p ActiveState --value graphdb)

if [[ $IS_RUNNING == "active" ]]; then
    echo -e "${GREEN}SUCCESS${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo "There was an error starting GraphDB."
    echo $OUTPUT
    exit 1
fi

echo -n "Downloading Node.js v14: "

OUTPUT=$(wget https://deb.nodesource.com/setup_14.x >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error downloading nodejs setup."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Setting up Node.js v14: "

OUTPUT=$(chmod +x setup_14.x)

OUTPUT=$(./setup_14.x >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error setting up nodejs."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Updating the Ubuntu repo: "

OUTPUT=$(apt update >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error updating the Ubuntu repo."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing aptitude: "

OUTPUT=$(apt install aptitude -y >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing aptitude."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing nodejs and npm: "

OUTPUT=$(aptitude install nodejs npm -y >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing nodejs/npm."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing forever: "

OUTPUT=$(npm install forever -g >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing forever."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing tcllib and mysql-server: "

OUTPUT=$(apt install tcllib mysql-server -y >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing tcllib and mysql-server."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Creating a local operational database: "

mysql -u root  -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */;"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error creating the database (Step 1 of 3)."
    echo $OUTPUT
    exit 1
fi

mysql -u root -e "update mysql.user set plugin = 'mysql_native_password' where User='root';"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error updating mysql.user set plugin (Step 2 of 3)."
    echo $OUTPUT
    exit 1
fi

mysql -u root -e "flush privileges;"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error flushing privileges (Step 3 of 3)."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Commenting out max_binlog_size: "

OUTPUT=$(sed -i 's|max_binlog_size|#max_binlog_size|' /etc/mysql/mysql.conf.d/mysqld.cnf >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error commenting out max_binlog_size."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Disabling binary logs: "

OUTPUT=$(echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error disabling binary logs."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Restarting mysql: "

OUTPUT=$(systemctl restart mysql >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error restarting mysql."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

# Change directory to ot-node
cd ot-node

echo -n "Executing npm install: "

OUTPUT=$(npm install >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error executing npm install."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Opening firewall ports 22,8900,9000: "

OUTPUT=$(ufw allow 22/tcp && ufw allow 8900 && ufw allow 9000 >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error opening the firewall ports."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Enabling the firewall: "

OUTPUT=$(yes | ufw enable >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error enabling the firewall."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Adding NODE_ENV=testnet to .env: "

OUTPUT=$(echo "NODE_ENV=testnet" > .env)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error adding the env variable."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo "Creating default noderc config${N1}"

read -p "Enter the operational wallet address: " NODE_WALLET
echo "Node wallet: $NODE_WALLET"

read -p "Enter the private key: " NODE_PRIVATE_KEY
echo "Node wallet: $NODE_PRIVATE_KEY"

cp $OTNODE_DIR/.origintrail_noderc_example $OTNODE_DIR/.origintrail_noderc

jq --arg newval "$NODE_WALLET" '.blockchain[].publicKey |= $newval' $OTNODE_DIR/.origintrail_noderc >> $OTNODE_DIR/origintrail_noderc_temp
mv $OTNODE_DIR/origintrail_noderc_temp $OTNODE_DIR/.origintrail_noderc

jq --arg newval "$NODE_PRIVATE_KEY" '.blockchain[].privateKey |= $newval' $OTNODE_DIR/.origintrail_noderc >> $OTNODE_DIR/origintrail_noderc_temp
mv $OTNODE_DIR/origintrail_noderc_temp $OTNODE_DIR/.origintrail_noderc

echo -n "Running DB migrations: "

OUTPUT=$(npx sequelize --config=./config/sequelizeConfig.js db:migrate >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error running the db migrations."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Starting the node: "

OUTPUT=$(forever start -a -o out.log -e out.log index.js >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error starting the node."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Logs will be displayed. Press ctrl+c to exit the logs. The node WILL stay running after you return to the command prompt."
echo " "
read -p "Press enter to continue..."

tail -f -n100 out.log
