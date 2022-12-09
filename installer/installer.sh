#!/bin/bash

OTNODE_DIR="/root/ot-node"
FUSEKI_VER="apache-jena-fuseki-4.5.0"
NODEJS_VER="16"

text_color() {
    GREEN='\033[0;32m'
    BGREEN='\033[1;32m'
    RED='\033[0;31m'
    BRED='\033[1;31m'
    YELLOW='\033[0;33m'
    BYELLOW='\033[1;33m'
    NC='\033[0m' # No Color
    echo -e "$@$NC"
}

header_color() {
    echo && text_color $@ && echo
}

perform_step() {
    N1=$'\n'
    echo -n "${@: -1}: "

    OUTPUT=$(${@:1:$#-1} 2>&1)

    if [[ $? -ne 0 ]]; then
        text_color $RED FAILED
        echo -e "${N1}Step failed. Output of error is:${N1}${N1}$OUTPUT"
        exit 1
    else
        text_color $GREEN OK
    fi
}

install_aliases() {
    if [[ -f "/root/.bashrc" ]]; then
        if grep -Fxq "alias otnode-restart='systemctl restart otnode.service'" ~/.bashrc; then
            echo "Aliases found, skipping."
        else
            echo "alias otnode-restart='systemctl restart otnode.service'" >> ~/.bashrc
            echo "alias otnode-stop='systemctl stop otnode.service'" >> ~/.bashrc
            echo "alias otnode-start='systemctl start otnode.service'" >> ~/.bashrc
            echo "alias otnode-logs='journalctl -u otnode --output cat -f'" >> ~/.bashrc
            echo "alias otnode-config='nano ~/ot-node/.origintrail_noderc'" >> ~/.bashrc
        fi
    else
        echo "bashrc does not exist. Proceeding with OriginTrail node installation."
    fi
}

install_directory() {
    ARCHIVE_REPOSITORY_URL="github.com/OriginTrail/ot-node/archive"
    BRANCH="v6/release/testnet"
    BRANCH_DIR="/root/ot-node-6-release-testnet"

    perform_step wget https://$ARCHIVE_REPOSITORY_URL/$BRANCH.zip "Downloading node files"
    perform_step unzip *.zip "Unzipping node files"
    perform_step rm *.zip "Removing zip file"
    OTNODE_VERSION=$(jq -r '.version' $BRANCH_DIR/package.json)
    perform_step mkdir $OTNODE_DIR "Creating new ot-node directory"
    perform_step mkdir $OTNODE_DIR/$OTNODE_VERSION "Creating new ot-node version directory"
    perform_step mv $BRANCH_DIR/* $OTNODE_DIR/$OTNODE_VERSION/ "Moving downloaded node files to ot-node version directory"
    OUTPUT=$(mv $BRANCH_DIR/.* $OTNODE_DIR/$OTNODE_VERSION/ 2>&1)
    perform_step rm -rf $BRANCH_DIR "Removing old directories"
    perform_step ln -sfn $OTNODE_DIR/$OTNODE_VERSION $OTNODE_DIR/current "Creating symlink from $OTNODE_DIR/$OTNODE_VERSION to $OTNODE_DIR/current"
}

install_firewall() {
    ufw allow 22/tcp && ufw allow 8900 && ufw allow 9000
    yes | ufw enable
}

install_fuseki() {
    wget https://dlcdn.apache.org/jena/binaries/$FUSEKI_VER.zip
    unzip $FUSEKI_VER.zip

    rm /root/$FUSEKI_VER.zip
    mkdir /root/ot-node/fuseki
    mkdir /root/ot-node/fuseki/tdb
    cp /root/$FUSEKI_VER/fuseki-server.jar /root/ot-node/fuseki/
    cp -r /root/$FUSEKI_VER/webapp/ /root/ot-node/fuseki/
    rm -r /root/$FUSEKI_VER

    perform_step cp $OTNODE_DIR/installer/data/fuseki.service /lib/systemd/system/

    systemctl daemon-reload
    systemctl enable fuseki
    systemctl start fuseki
    systemctl status fuseki
}

install_blazegraph() {
    wget https://github.com/blazegraph/database/releases/latest/download/blazegraph.jar
    mv blazegraph.jar $OTNODE_DIR/../blazegraph.jar
    cp $OTNODE_DIR/installer/data/blazegraph.service /lib/systemd/system/

    systemctl daemon-reload
    systemctl enable blazegraph
    systemctl start blazegraph
    systemctl status blazegraph
}

install_mysql() {
    if [ -d "/var/lib/mysql/operationaldb/" ]; then
    #check if operationaldb already exists
        text_color $YELLOW "Old sql database detected. Please enter your sql password to overwrite it."
        for x in {1..5}; do
            read -p "Enter your sql repository password (leave blank if none): " password
            echo -n "Deleting old sql database: "
            OUTPUT=$(MYSQL_PWD=$password mysql -u root -e "DROP DATABASE IF EXISTS operationaldb;" 2>&1)     
            if [[ $? -ne 0 ]]; then
                text_color $RED "FAILED"
                echo -e "${N1}Step failed. Output of error is:${N1}${N1}$OUTPUT"
                text_color $YELLOW "Wrong password entered. Try again ($x/5)"
            else
                text_color $GREEN "OK"
                if [ -z "$password" ]; then
                    for z in {1..2}; do
                        read -p "Enter a new sql repository password if you wish (do not leave blank): " password
                        if [ -n "$password" ]; then
                            echo -n "Configuring new sql password: "
                            OUTPUT=$(mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$password';" 2>&1)
                            if [[ $? -ne 0 ]]; then
                                text_color $RED "FAILED"
                                echo -e "${N1}Step failed. Output of error is:${N1}${N1}$OUTPUT"
                                exit 1
                            else
                                text_color $GREEN "OK"
                                break
                            fi
                        else
                            text_color $YELLOW "You must enter a sql repository password. Please try again." 
                        fi
                    done
                fi
                break
            fi
            if [ $x == 5 ]; then
                text_color $RED "FAILED. If you forgot your sql password, you must reset it before attempting this installer again."
                exit 1
            fi
        done
    else
        OUTPUT=$(mysql -u root -e "status;" 2>&1)
        #check if sql is password protected
        if [[ $? -ne 0 ]]; then
            for y in {1..5}; do
                read -p "Enter your sql repository password: " password
                echo -n "Password check: "
                OUTPUT=$(MYSQL_PWD=$password mysql -u root -e "status;" 2>&1)
                #check whether entered password matches current sql password
                if [[ $? -ne 0 ]]; then
                    text_color $YELLOW "ERROR - The sql password provided does not match your current sql password. Please try again ($y/5)"
                else
                    text_color $GREEN "OK"
                    break
                fi
                if [ $y == 5 ]; then
                    text_color $RED "FAILED. If you forgot your sql password, you must reset it before attempting this installer again."
                    exit 1
                fi
            done
        else
            text_color $YELLOW "No sql repository password detected."
            for y in {1..2}; do
                read -p "Enter a new sql repository password (do not leave blank): " password
                if [ -n "$password" ]; then
                #if password isn't blank
                    echo -n "Configuring new sql password: "
                    OUTPUT=$(mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$password';" 2>&1)
                    if [[ $? -ne 0 ]]; then
                        text_color $RED "FAILED"
                        echo -e "${N1}Step failed. Output of error is:${N1}${N1}$OUTPUT"
                        exit 1
                    else
                        text_color $GREEN "OK"
                        break
                    fi
                else
                    text_color $YELLOW "You must enter a sql repository password. Please try again." 
                fi
            done
        fi
    fi

    echo "REPOSITORY_PASSWORD=$password" > $OTNODE_DIR/.env
    echo -n "Creating new sql database: "
    OUTPUT=$(MYSQL_PWD=$password mysql -u root -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */;" 2>&1)
    if [[ $? -ne 0 ]]; then
        text_color $RED "FAILED"
        echo -e "${N1}Step failed. Output of error is:${N1}${N1}$OUTPUT"
        exit 1
    else
        text_color $GREEN "OK"
    fi
    perform_step sed -i 's|max_binlog_size|#max_binlog_size|' /etc/mysql/mysql.conf.d/mysqld.cnf "Setting max log size"
    echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf
    perform_step sed -i '/disable_log_bin/a\wait_timeout=31536000' /etc/mysql/mysql.conf.d/mysqld.cnf "Setting wait timeout"
    perform_step sed -i '/disable_log_bin/a\interactive_timeout=31536000' /etc/mysql/mysql.conf.d/mysqld.cnf "Setting interactive timeout"

    systemctl restart mysql
}

install_node() {
    # Change directory to ot-node/current
    cd $OTNODE_DIR

    npm ci --omit=dev --ignore-scripts "Executing npm ci --omit=dev --ignore-scripts"

    echo "NODE_ENV=testnet" >> $OTNODE_DIR/.env

    touch $CONFIG_DIR/.origintrail_noderc
    jq --null-input --arg tripleStore "$tripleStore" '{"logLevel": "trace", "auth": {"ipWhitelist": ["::1", "127.0.0.1"]}, "modules": {"tripleStore":{"defaultImplementation": $tripleStore}}}' > $CONFIG_DIR/.origintrail_noderc

    jq --arg blockchain "otp" --arg evmOperationalWallet "$EVM_OPERATIONAL_WALLET" --arg evmOperationalWalletPrivateKey "$EVM_OPERATIONAL_PRIVATE_KEY" --arg evmManagementWallet "$EVM_MANAGEMENT_WALLET" --arg evmManagementWallet "$SHARES_TOKEN_NAME" --arg evmManagementWallet "$SHARES_TOKEN_SYMBOL" '.modules.blockchain.implementation[$blockchain].config |= { "evmOperationalWalletPublicKey": $evmOperationalWallet, "evmOperationalWalletPrivateKey": $evmOperationalWalletPrivateKey, "evmManagementWalletPublicKey": $evmManagementWallet, "sharesTokenName": $sharesTokenName, "sharesTokenSymbol": $sharesTokenSymbol} + .' $CONFIG_DIR/.origintrail_noderc > $CONFIG_DIR/origintrail_noderc_tmp
    mv $CONFIG_DIR/origintrail_noderc_tmp $CONFIG_DIR/.origintrail_noderc

    cp $OTNODE_DIR/installer/data/otnode.service /lib/systemd/system/

    systemctl daemon-reload
    systemctl enable otnode
    systemctl start otnode
    systemctl status otnode
}

clear

cd /root

header_color $BGREEN "Welcome to the OriginTrail Installer. Please sit back while the installer runs. "

header_color $BGREEN "Installing OriginTrail node pre-requisites..."

perform_step install_aliases "Updating .bashrc file with OriginTrail node aliases"
perform_step rm /var/lib/dpkg/lock-frontend "Removing any frontend locks"
perform_step apt update "Updating Ubuntu package repository"
perform_step export DEBIAN_FRONTEND=noninteractive "Updating Ubuntu to latest version 1/2"
perform_step apt upgrade -y "Updating Ubuntu to latest version 2/2"
perform_step apt install default-jre unzip jq -y "Installing default-jre, unzip, jq"
perform_step apt install build-essential -y "Installing build-essential"
perform_step wget https://deb.nodesource.com/setup_$NODEJS_VER.x "Downloading Node.js v$NODEJS_VER"
chmod +x setup_$NODEJS_VER.x
perform_step ./setup_$NODEJS_VER.x "Installing Node.js v$NODEJS_VER"
rm -rf setup_$NODEJS_VER.x
perform_step apt update "Updating the Ubuntu repo"
perform_step apt-get install nodejs -y "Installing node.js"
perform_step npm install -g npm "Installing npm"
perform_step apt-get install tcllib mysql-server -y "Installing tcllib and mysql-server"
perform_step apt remove unattended-upgrades -y "Remove unattended upgrades"
perform_step install_directory "Assembling ot-node directory"
perform_step install_firewall "Configuring firewall"

OTNODE_DIR=$OTNODE_DIR/current

header_color $BGREEN "Installing Triplestore (Graph Database)..."

while true; do
    read -p "Please select the database you would like to use: [1]Fuseki [2]Blazegraph [E]xit: " choice
    case "$choice" in
        [1gG]* ) echo -e "Fuseki selected. Proceeding with installation."; tripleStore=ot-fuseki; perform_step install_fuseki "Installing Fuseki"; break;;
        [2bB]* ) echo -e "Blazegraph selected. Proceeding with installation."; tripleStore=ot-blazegraph; perform_step install_blazegraph "Installing Blazegraph"; break;;
        [Ee]* ) echo "Installer stopped by user"; exit;;
        * ) echo "Please make a valid choice and try again.";;
    esac
done

header_color $BGREEN "Installing MySQL..."

install_mysql

header_color $BGREEN "Configuring OriginTrail node..."

CONFIG_DIR=$OTNODE_DIR/..

#blockchains=("otp" "polygon")
#for ((i = 0; i < ${#blockchains[@]}; ++i));
#do
#   read -p "Do you want to connect your node to blockchain: ${blockchains[$i]} ? [Y]Yes [N]No [E]Exit: " choice
#	case "$choice" in
#       [Yy]* )

#            read -p "Enter your substrate operational wallet address: " SUBSTRATE_OPERATIONAL_WALLET
#            echo "Substrate operational wallet address: $SUBSTRATE_OPERATIONAL_WALLET"

#            read -p "Enter your substrate operational wallet private key: " SUBSTRATE_OPERATIONAL_PRIVATE_KEY
#            echo "Substrate operational wallet private key: $SUBSTRATE_OPERATIONAL_PRIVATE_KEY"

            read -p "Enter your EVM operational wallet address: " EVM_OPERATIONAL_WALLET
            text_color $GREEN "EVM operational wallet address: $EVM_OPERATIONAL_WALLET"

            read -p "Enter your EVM operational wallet private key: " EVM_OPERATIONAL_PRIVATE_KEY
            text_color $GREEN "EVM operational wallet private key: $EVM_OPERATIONAL_PRIVATE_KEY"

#            read -p "Enter your substrate management wallet address: " SUBSTRATE_MANAGEMENT_WALLET
#            echo "Substrate management wallet address: $SUBSTRATE_MANAGEMENT_WALLET"

#            read -p "Enter your substrate management wallet private key: " SUBSTRATE_MANAGEMENT_WALLET_PRIVATE_KEY
#            echo "Substrate management wallet private key: $SUBSTRATE_MANAGEMENT_WALLET_PRIVATE_KEY"

            read -p "Enter your EVM management wallet address: " EVM_MANAGEMENT_WALLET
            text_color $GREEN "EVM management wallet address: $EVM_MANAGEMENT_WALLET"

            read -p "Enter your profile shares token name: " SHARES_TOKEN_NAME
            text_color $GREEN "Profile shares token name: $SHARES_TOKEN_NAME"

            read -p "Enter your profile shares token symbol: " SHARES_TOKEN_SYMBOL
            text_color $GREEN "Profile shares token name: $SHARES_TOKEN_SYMBOL"
            # ;;
#      [Nn]* ) ;;
#     [Ee]* ) echo "Installer stopped by user"; exit;;
    #    * ) ((--i));echo "Please make a valid choice and try again.";;
    #esac
#done

perform_step install_node "Configuring ot-node"

text_color $GREEN "Logs will be displayed. Press ctrl+c to exit the logs. The node WILL stay running after you return to the command prompt."
echo ""
text_color $GREEN "If the logs do not show and the screen hangs, press ctrl+c to exit the installation and reboot your server."
echo ""
read -p "Press enter to continue..."

journalctl -u otnode --output cat -fn 100
