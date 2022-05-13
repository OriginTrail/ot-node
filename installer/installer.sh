#!/bin/bash

ARCHIVE_REPOSITORY_URL="github.com/OriginTrail/ot-node/archive"
BRANCH="v6/release/testnet"
BRANCH_DIR="/root/ot-node-6-release-testnet"
OTNODE_DIR="/root/ot-node"
N1=$'\n'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color
FILE=/root/.bashrc

clear

cd /root

echo -n "Updating .bashrc file with OriginTrail node aliases: "
if [ -f "$FILE" ]; then
    echo "alias otnode-restart='systemctl restart otnode.service'" >> ~/.bashrc
    echo "alias otnode-stop='systemctl stop otnode.service'" >> ~/.bashrc
    echo "alias otnode-start='systemctl start otnode.service'" >> ~/.bashrc
    echo "alias otnode-logs='journalctl -u otnode --output cat -f'" >> ~/.bashrc
    echo "alias otnode-config='nano ~/ot-node/.origintrail_noderc'" >> ~/.bashrc
    source ~/.bashrc
    echo -e "${GREEN}SUCCESS${NC}"
else
    echo "$FILE does not exist. Proceeding with OriginTrail node installation."
fi

echo -n "Updating Ubuntu package repository: "

OUTPUT=$(apt update 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error updating the Ubuntu repo."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Updating Ubuntu to latest version (may take a few minutes): "

OUTPUT=$(export DEBIAN_FRONTEND=noninteractive && apt upgrade -y 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo -n "There was an error updating Ubuntu to the latest version."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing default-jre: "

OUTPUT=$(apt install default-jre unzip jq -y 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing default-jre."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing build-essential: "

OUTPUT=$(apt install build-essential -y 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing build-essential."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Downloading ot-node: "

OUTPUT=$(wget https://$ARCHIVE_REPOSITORY_URL/$BRANCH.zip 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error downloading ot-node."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

OUTPUT=$(unzip *.zip 2>&1)
rm *.zip
#Download new version .zip file
#Unpack to init folder

OTNODE_VERSION=$(jq -r '.version' $BRANCH_DIR/package.json)

mkdir $OTNODE_DIR

mkdir $OTNODE_DIR/$OTNODE_VERSION

mv $BRANCH_DIR/* $OTNODE_DIR/$OTNODE_VERSION
mv $BRANCH_DIR/.* $OTNODE_DIR/$OTNODE_VERSION

rm -r $BRANCH_DIR

ln -sfn $OTNODE_DIR/$OTNODE_VERSION $OTNODE_DIR/current

OTNODE_DIR=$OTNODE_DIR/current

while true; do
    read -p "Please select the database you would like to use: [1]Fuseki [2]Blazegraph [E]xit: " choice
    case "$choice" in
        [1gG]* ) echo -e "Fuseki selected. Proceeding with installation."; DATABASE=fuseki; break;;
        [2bB]* ) echo -e "Blazegraph selected. Proceeding with installation."; DATABASE=blazegraph; break;;
        [Ee]* ) echo "Installer stopped by user"; exit;;
        * ) echo "Please make a valid choice and try again.";;
    esac
done

if [[ $DATABASE = "fuseki" ]]; then

    echo -n "Downloading Apache Jena Fuseki: "

    OUTPUT=$(wget https://dlcdn.apache.org/jena/binaries/apache-jena-fuseki-4.4.0.zip 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error downloading Fuseki."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    echo -n "Unzipping Fuseki .zip file: "
    OUTPUT=$(unzip apache-jena-fuseki-4.4.0.zip 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error unzipping Fuseki."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    echo -n "Setting up fuseki folder in /root/fuseki: "

    OUTPUT=$(rm /root/apache-jena-fuseki-4.4.0.zip &&
            mkdir /root/fuseki &&
            mkdir /root/fuseki/tdb &&
            cp /root/apache-jena-fuseki-4.4.0/fuseki-server.jar /root/fuseki/ &&
            cp -r /root/apache-jena-fuseki-4.4.0/webapp/ /root/fuseki/ 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an setting up the fuseki folder in /root/fuseki."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    echo -n "Copying fuseki service file: "

    OUTPUT=$(cp $OTNODE_DIR/installer/data/fuseki.service /lib/systemd/system/ 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error copying the fuseki service file."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    systemctl daemon-reload

    echo -n "Enable Fuseki service on boot: "

    OUTPUT=$(systemctl enable fuseki 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error enabling Fuseki."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    echo -n "Starting Fuseki: "

    OUTPUT=$(systemctl start fuseki 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error starting Fuseki."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    echo -n "Confirming Fuseki has started: "

    IS_RUNNING=$(systemctl show -p ActiveState --value fuseki)

    if [[ $IS_RUNNING == "active" ]]; then
        echo -e "${GREEN}SUCCESS${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo "There was an error starting Fuseki."
        echo $OUTPUT
        exit 1
    fi

fi

if [[ $DATABASE = "blazegraph" ]]; then

    echo -n "Downloading Blazegraph: "

    OUTPUT=$(wget https://github.com/blazegraph/database/releases/latest/download/blazegraph.jar 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error downloading Blazegraph."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    echo -n "Copying blazegraph service file: "

    OUTPUT=$(cp $OTNODE_DIR/installer/data/blazegraph.service /lib/systemd/system/ 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error copying the blazegraph service file."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    systemctl daemon-reload

    echo -n "Enable Blazegraph service on boot: "

    OUTPUT=$(systemctl enable blazegraph 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error enabling Blazegraph."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    echo -n "Starting Blazegraph: "

    OUTPUT=$(systemctl start blazegraph 2>&1)

    if [[ $? -ne 0 ]]; then
        echo -e "${RED}FAILED${NC}"
        echo "There was an error starting Blazegraph."
        echo $OUTPUT
        exit 1
    else
        echo -e "${GREEN}SUCCESS${NC}"
    fi

    echo -n "Confirming Blazegraph has started: "

    IS_RUNNING=$(systemctl show -p ActiveState --value blazegraph)

    if [[ $IS_RUNNING == "active" ]]; then
        echo -e "${GREEN}SUCCESS${NC}"
    else
        echo -e "${RED}FAILED${NC}"
        echo "There was an error starting Blazegraph."
        echo $OUTPUT
        exit 1
    fi
fi

echo -n "Downloading Node.js v16: "

OUTPUT=$(wget https://deb.nodesource.com/setup_16.x 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error downloading node.js setup."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Setting up Node.js v16: "

OUTPUT=$(chmod +x setup_16.x)

OUTPUT=$(./setup_16.x 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error setting up node.js."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

rm -rf setup_16.x

echo -n "Updating the Ubuntu repo: "

OUTPUT=$(apt update 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error updating the Ubuntu repo."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing node.js: "

 OUTPUT=$(apt-get install nodejs -y 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing node.js."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing npm: "

 OUTPUT=$(npm install -g npm 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing npm."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing tcllib and mysql-server: "

OUTPUT=$(apt-get install tcllib mysql-server -y 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing tcllib and mysql-server."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Creating a local operational database: "

mysql -u root -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */;"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error creating the database (Step 1 of 2)."
    echo $OUTPUT
    exit 1
fi

mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error updating mysql.user set plugin (Step 2 of 2)."
    echo $OUTPUT
    exit 1
fi

echo -n "Commenting out max_binlog_size: "

OUTPUT=$(sed -i 's|max_binlog_size|#max_binlog_size|' /etc/mysql/mysql.conf.d/mysqld.cnf 2>&1)
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

OUTPUT=$(systemctl restart mysql 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error restarting mysql."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "remove unattended upgrades: "

OUTPUT=$(apt remove unattended-upgrades -y 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error removing unattended upgrades."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

# Change directory to ot-node/current
cd $OTNODE_DIR

echo -n "Executing npm ci --omit=dev --ignore-scripts: "

OUTPUT=$(npm ci --omit=dev --ignore-scripts 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error executing npm install."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Opening firewall ports 22,8900,9000: "

OUTPUT=$(ufw allow 22/tcp && ufw allow 8900 && ufw allow 9000 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error opening the firewall ports."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Enabling the firewall: "

OUTPUT=$(yes | ufw enable 2>&1)
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
echo "Node private key: $NODE_PRIVATE_KEY"

CONFIG_DIR=$OTNODE_DIR/../

cp $OTNODE_DIR/.origintrail_noderc_example $CONFIG_DIR/.origintrail_noderc

jq --arg newval "$NODE_WALLET" '.blockchain[].publicKey |= $newval' $CONFIG_DIR/.origintrail_noderc >> $CONFIG_DIR/origintrail_noderc_temp
mv $CONFIG_DIR/origintrail_noderc_temp $CONFIG_DIR/.origintrail_noderc

jq --arg newval "$NODE_PRIVATE_KEY" '.blockchain[].privateKey |= $newval' $CONFIG_DIR/.origintrail_noderc >> $CONFIG_DIR/origintrail_noderc_temp
mv $CONFIG_DIR/origintrail_noderc_temp $CONFIG_DIR/.origintrail_noderc

if [[ $DATABASE = "blazegraph" ]]; then
    jq '.graphDatabase |= {"implementation": "Blazegraph", "url": "http://localhost:9999/blazegraph"} + .' $CONFIG_DIR/.origintrail_noderc >> $CONFIG_DIR/origintrail_noderc_temp
    mv $CONFIG_DIR/origintrail_noderc_temp $CONFIG_DIR/.origintrail_noderc
fi

if [[ $DATABASE = "fuseki" ]]; then
    jq '.graphDatabase |= {"name": "node0", "implementation": "Fuseki", "url": "http://localhost:3030"} + .' $CONFIG_DIR/.origintrail_noderc >> $CONFIG_DIR/origintrail_noderc_temp
    mv $CONFIG_DIR/origintrail_noderc_temp $CONFIG_DIR/.origintrail_noderc
fi

echo -n "Running DB migrations: "

OUTPUT=$(npx sequelize --config=./config/sequelizeConfig.js db:migrate 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error running the db migrations."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Copying otnode service file: "

OUTPUT=$(cp $OTNODE_DIR/installer/data/otnode.service /lib/systemd/system/ 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error copying the otnode service file."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

systemctl daemon-reload

echo -n "Enable otnode service on boot: "

OUTPUT=$(systemctl enable otnode 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error enabling the otnode service."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Starting otnode: "

OUTPUT=$(systemctl start otnode 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error starting the node."
    echo $OUTPUT
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Confirming the node has started: "

IS_RUNNING=$(systemctl show -p ActiveState --value otnode)

if [[ $IS_RUNNING == "active" ]]; then
    echo -e "${GREEN}SUCCESS${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo "There was an error starting the node."
    echo $OUTPUT
    exit 1
fi

echo -n "Logs will be displayed. Press ctrl+c to exit the logs. The node WILL stay running after you return to the command prompt."
echo ""
echo "If the logs do not show and the screen hangs, press ctrl+c to exit the installation and reboot your server."
echo ""
read -p "Press enter to continue..."

journalctl -u otnode --output cat -fn 100
