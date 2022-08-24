#!/bin/bash

ARCHIVE_REPOSITORY_URL="github.com/OriginTrail/ot-node/archive"
BRANCH="v6/release/testnet"
BRANCH_DIR="/root/ot-node-6-release-testnet"
OTNODE_DIR="/root/ot-node"
FUSEKI_VER="apache-jena-fuseki-4.5.0"
NODEJS_VER="16"
BASHRC_FILE=/root/.bashrc

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
    if [ -f "$BASHRC_FILE" ]; then
        if grep -Fxq "alias otnode-restart='systemctl restart otnode.service'" $BASHRC_FILE; then
            echo "Aliases found, skipping."
        else
            echo "alias otnode-restart='systemctl restart otnode.service'" >> ~/.bashrc
            echo "alias otnode-stop='systemctl stop otnode.service'" >> ~/.bashrc
            echo "alias otnode-start='systemctl start otnode.service'" >> ~/.bashrc
            echo "alias otnode-logs='journalctl -u otnode --output cat -f'" >> ~/.bashrc
            echo "alias otnode-config='nano ~/ot-node/.origintrail_noderc'" >> ~/.bashrc
            source ~/.bashrc
        fi
    else
        echo "$BASHRC_FILE does not exist. Proceeding with OriginTrail node installation."
    fi
}

install_directory() {
    #Download new version .zip file
    #Unpack to init folder
    perform_step wget https://$ARCHIVE_REPOSITORY_URL/$BRANCH.zip "Downloading node files"
    perform_step unzip *.zip "Unzipping node files"
    rm *.zip
    OTNODE_VERSION=$(jq -r '.version' $BRANCH_DIR/package.json)
    mkdir $OTNODE_DIR
    mkdir $OTNODE_DIR/$OTNODE_VERSION
    shopt -s dotglob
    mv $BRANCH_DIR/* $OTNODE_DIR/$OTNODE_VERSION/
    rm -rf $BRANCH_DIR
    perform_step ln -sfn $OTNODE_DIR/$OTNODE_VERSION $OTNODE_DIR/current "Configuring node directory"
}

install_firewall() {
    ufw allow 22/tcp
    ufw allow 8900
    ufw allow 9000
    yes | ufw enable
}

install_fuseki() {
    perform_step wget https://dlcdn.apache.org/jena/binaries/$FUSEKI_VER.zip "Downloading Fuseki"
    perform_step unzip $FUSEKI_VER.zip "Unzipping Fuseki"
    rm /root/$FUSEKI_VER.zip
    mkdir /root/fuseki
    mkdir /root/fuseki/tdb
    cp /root/$FUSEKI_VER/fuseki-server.jar /root/fuseki/
    cp -r /root/$FUSEKI_VER/webapp/ /root/fuseki/
    rm -r /root/$FUSEKI_VER
    perform_step cp $OTNODE_DIR/installer/data/fuseki.service /lib/systemd/system/ "Copying Fuseki service file"
    systemctl daemon-reload
    perform_step systemctl enable fuseki "Enabling Fuseki"
    perform_step systemctl start fuseki "Starting Fuseki"
    perform_step systemctl status fuseki "Fuseki status"
}

install_blazegraph() {
    perform_step wget https://github.com/blazegraph/database/releases/latest/download/blazegraph.jar "Downloading Blazegraph"
    perform_step cp $OTNODE_DIR/installer/data/blazegraph.service /lib/systemd/system/ "Copying Blazegraph service file"
    systemctl daemon-reload
    perform_step systemctl enable blazegraph "Enabling Blazegrpah"
    perform_step systemctl start blazegraph "Starting Blazegraph"
    perform_step systemctl status blazegraph "Blazegraph status"
}

install_sql() {
    while true; do
        read -p "Please select the SQL you would like to use: [1]MySQL [2]MariaDB [E]xit " choice
        case "$choice" in
            [1]* )  text_color $GREEN "MySQL selected. Proceeding with installation."
                    sql=mysql
                    export DEBIAN_FRONTEND=noninteractive
                    perform_step apt-get install mysql-server -y "Installing mysql-server"
                    break;;
            [2]* )  text_color $GREEN "MariaDB selected. Proceeding with installation."
                    sql=mariadb
                    export DEBIAN_FRONTEND=noninteractive
                    perform_step apt-get install mariadb-server -y "Installing mariadb-server"
                    break;;
            [Ee]* ) text_color $RED "Installer stopped by user"; exit;;
            * )     text_color $YELLOW "Please make a valid choice and try again.";;
        esac
    done

    if [ -d "/var/lib/mysql/operationaldb/" ]; then
    #check if operationaldb already exists
        text_color $YELLOW "Old sql database detected. Please enter your sql password to overwrite it."
        for x in {1..5}; do
            read -p "Enter your sql repository password (leave blank if none): " password
            echo -n "Deleting old sql database: "
            OUTPUT=$(MYSQL_PWD=$password $sql -u root -e "DROP DATABASE IF EXISTS operationaldb;" 2>&1)     
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
                            OUTPUT=$($sql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$password';" 2>&1)
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
        OUTPUT=$($sql -u root -e "status;" 2>&1)
        #check if sql is password protected
        if [[ $? -ne 0 ]]; then
            for y in {1..5}; do
                read -p "Enter your sql repository password: " password
                echo -n "Password check: "
                OUTPUT=$(MYSQL_PWD=$password $sql -u root -e "status;" 2>&1)
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
                    OUTPUT=$($sql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$password';" 2>&1)
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
    OUTPUT=$(MYSQL_PWD=$password $sql -u root -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */;" 2>&1)
    if [[ $? -ne 0 ]]; then
        text_color $RED "FAILED"
        echo -e "${N1}Step failed. Output of error is:${N1}${N1}$OUTPUT"
        exit 1
    else
        text_color $GREEN "OK"
    fi
    
    if [ $sql = mysql ]; then
        perform_step sed -i 's|max_binlog_size|#max_binlog_size|' /etc/mysql/mysql.conf.d/mysqld.cnf "Setting max log size"
        echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf
        perform_step sed -i '/disable_log_bin/a wait_timeout = 31536000' /etc/mysql/mysql.conf.d/mysqld.cnf "Setting wait timeout"
        perform_step sed -i '/disable_log_bin/a interactive_timeout = 31536000' /etc/mysql/mysql.conf.d/mysqld.cnf "Setting interactive timeout"
    fi
    if [ $sql = mariadb ]; then
        perform_step sed -i 's|max_binlog_size|#max_binlog_size|' /etc/mysql/mariadb.conf.d/50-server.cnf "Setting max log size"
        echo "disable_log_bin" >> /etc/mysql/mariadb.conf.d/50-server.cnf
        perform_step sed -i '/disable_log_bin/a wait_timeout = 31536000' /etc/mysql/mariadb.conf.d/50-server.cnf "Setting wait timeout"
        perform_step sed -i '/disable_log_bin/a interactive_timeout = 31536000' /etc/mysql/mariadb.conf.d/50-server.cnf "Setting interactive timeout"
    fi
    perform_step systemctl restart $sql "Restarting $sql"
}

install_node() {
    # Change directory to ot-node/current
    cd $OTNODE_DIR

    perform_step npm ci --omit=dev --ignore-scripts "Executing npm ci --omit=dev --ignore-scripts"

    echo "NODE_ENV=testnet" >> $OTNODE_DIR/.env

    perform_step touch $CONFIG_DIR/.origintrail_noderc "Configuring node config file"
    jq --null-input --arg tripleStore "$tripleStore" '{"logLevel": "trace", "auth": {"ipWhitelist": ["::1", "127.0.0.1"]}, "modules": {"tripleStore":{"defaultImplementation": $tripleStore}}}' > $CONFIG_DIR/.origintrail_noderc

    jq --arg blockchain "otp" --arg evmOperationalWallet "$EVM_OPERATIONAL_WALLET" --arg evmOperationalWalletPrivateKey "$EVM_OPERATIONAL_PRIVATE_KEY" --arg evmManagementWallet "$EVM_MANAGEMENT_WALLET" '.modules.blockchain.implementation[$blockchain].config |= { "evmOperationalWalletPublicKey": $evmOperationalWallet, "evmOperationalWalletPrivateKey": $evmOperationalWalletPrivateKey, "evmManagementWalletPublicKey": $evmManagementWallet} + .' $CONFIG_DIR/.origintrail_noderc > $CONFIG_DIR/origintrail_noderc_tmp
    mv $CONFIG_DIR/origintrail_noderc_tmp $CONFIG_DIR/.origintrail_noderc

    perform_step cp $OTNODE_DIR/installer/data/otnode.service /lib/systemd/system/ "Copying otnode service file"
    
    systemctl daemon-reload
    perform_step systemctl enable otnode "Enabling otnode"
    perform_step systemctl start otnode "Starting otnode"
    perform_step systemctl status otnode "otnode status"
}

clear

cd /root

header_color $BGREEN "Welcome to the OriginTrail Installer. Please sit back while the installer runs. "

header_color $BGREEN "Installing OriginTrail node pre-requisites..."

export DEBIAN_FRONTEND=noninteractive
perform_step install_aliases "Updating .bashrc file with OriginTrail node aliases"
perform_step rm -rf /var/lib/dpkg/lock-frontend "Removing any frontend locks"
perform_step apt update "Updating Ubuntu package repository"
perform_step apt upgrade -y "Updating Ubuntu to latest version"
perform_step apt install default-jre unzip jq build-essential -y "Installing default-jre, unzip, jq"
perform_step wget https://deb.nodesource.com/setup_$NODEJS_VER.x "Downloading Node.js v$NODEJS_VER"
chmod +x setup_$NODEJS_VER.x
perform_step ./setup_$NODEJS_VER.x "Installing Node.js v$NODEJS_VER"
rm -rf setup_$NODEJS_VER.x
perform_step apt update "Updating Ubuntu package repository"
perform_step apt-get install nodejs tcllib -y "Installing node.js and tcllib"
perform_step npm install -g npm "Installing npm"
perform_step install_firewall "Configuring firewall"
perform_step apt remove unattended-upgrades -y "Remove unattended upgrades"


header_color $BGREEN "Preparing OriginTrail node directory..."


if [[ -d "$OTNODE_DIR" ]]; then
    while true; do
        read -p "Previous ot-node directory detected. Would you like to overwrite it ? [Y]es [N]o [E]xit " choice
        case "$choice" in
        [yY]* ) text_color $GREEN "Reinstalling ot-node directory."; rm -rf $OTNODE_DIR; install_directory; break;;
        [nN]* ) text_color $GREEN "Keeping previous ot-node directory."; break;;
        [eE]* ) text_color $RED "Installer stopped by user"; exit;;
        * )     text_color $YELLOW "Please make a valid choice and try again.";;
        esac
    done
else
    install_directory
fi

OTNODE_DIR=$OTNODE_DIR/current

header_color $BGREEN "Installing Triplestore (Graph Database)..."

while true; do
    read -p "Please select the database you would like to use: [1]Fuseki [2]Blazegraph [E]xit: " choice
    case "$choice" in
        [1gG]* ) text_color $GREEN "Fuseki selected. Proceeding with installation."; tripleStore=ot-fuseki; break;;
        [2bB]* ) text_color $GREEN "Blazegraph selected. Proceeding with installation."; tripleStore=ot-blazegraph; break;;
        [Ee]* )  text_color $RED "Installer stopped by user"; exit;;
        * )      text_color $YELLOW "Please make a valid choice and try again.";;
    esac
done

if [ $tripleStore = "ot-fuseki" ]; then
    if [ -d "/root/fuseki" ]; then
        while true; do
            read -p "Previous Fuseki triplestore detected. Would you like to overwrite it ? [Y]es [N]o [E]xit " choice
            case "$choice" in
            [yY]* ) text_color $GREEN "Reinstalling Fuseki."; rm -rf fuseki*; install_fuseki; break;;
            [nN]* ) text_color $GREEN "Keeping previous Fuseki installation."; break;;
            [eE]* ) text_color $RED "Installer stopped by user"; exit;;
            * )     text_color $YELLOW "Please make a valid choice and try again.";;
            esac
        done
    else
        install_fuseki
    fi
fi

if [ $tripleStore = "ot-blazegraph" ]; then
    if [ -f "blazegraph.jar" ]; then
        while true; do
            read -p "Previous Blazegraph triplestore detected. Would you like to overwrite it ? [Y]es [N]o [E]xit " choice
            case "$choice" in
            [yY]* ) text_color $GREEN "Reinstalling Blazegraph."; rm -rf blazegraph*; install_blazegraph; break;;
            [nN]* ) text_color $GREEN "Keeping old Blazegraph Installation."; break;;
            [eE]* ) text_color $RED "Installer stopped by user"; exit;;
            * )     text_color $YELLOW "Please make a valid choice and try again.";;
            esac
        done
    else
        install_blazegraph
    fi
fi

header_color $BGREEN "Installing SQL..."

install_sql

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

#            read -p "Enter your EVM management wallet private key: " EVM_MANAGEMENT_PRIVATE_KEY
#            echo "EVM management wallet private key: $EVM_MANAGEMENT_PRIVATE_KEY"
            # ;;
#      [Nn]* ) ;;
#     [Ee]* ) echo "Installer stopped by user"; exit;;
    #    * ) ((--i));echo "Please make a valid choice and try again.";;
    #esac
#done

install_node

text_color $GREEN "Logs will be displayed. Press ctrl+c to exit the logs. The node WILL stay running after you return to the command prompt."
echo ""
text_color $GREEN "If the logs do not show and the screen hangs, press ctrl+c to exit the installation and reboot your server."
echo ""
read -p "Press enter to continue..."

journalctl -u otnode --output cat -fn 100