#!/bin/bash

OTNODE_DIR="/root/ot-node"

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
    BRANCH="v6/release/mainnet"
    BRANCH_DIR="/root/ot-node-6-release-mainnet"

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

install_prereqs() {
    export DEBIAN_FRONTEND=noninteractive
    NODEJS_VER="16"

    perform_step install_aliases "Updating .bashrc file with OriginTrail node aliases"
    perform_step rm -rf /var/lib/dpkg/lock-frontend "Removing any frontend locks"
    perform_step apt update "Updating Ubuntu package repository"
    perform_step apt upgrade -y "Updating Ubuntu to latest version"
    perform_step apt install unzip jq -y "Installing unzip, jq"
    perform_step apt install default-jre -y "Installing default-jre"
    perform_step apt install build-essential -y "Installing build-essential"
    perform_step wget https://deb.nodesource.com/setup_$NODEJS_VER.x "Downloading Node.js v$NODEJS_VER"
    chmod +x setup_$NODEJS_VER.x
    perform_step ./setup_$NODEJS_VER.x "Installing Node.js v$NODEJS_VER"
    rm -rf setup_$NODEJS_VER.x
    perform_step apt update "Updating Ubuntu package repository"
    perform_step apt-get install nodejs -y "Installing node.js"
    perform_step npm install -g npm "Installing npm"
    perform_step install_firewall "Configuring firewall"
    perform_step apt remove unattended-upgrades -y "Remove unattended upgrades"
}

install_fuseki() {
    FUSEKI_VER="apache-jena-fuseki-$(git ls-remote --tags https://github.com/apache/jena | grep -o 'refs/tags/jena-[0-9]*\.[0-9]*\.[0-9]*' | sort -r | head -n 1 | grep -o '[^\/-]*$')"
    FUSEKI_PREV_VER="apache-jena-fuseki-$(git ls-remote --tags https://github.com/apache/jena | grep -o 'refs/tags/jena-[0-9]*\.[0-9]*\.[0-9]*' | sort -r | head -n 3 | tail -n 1 | grep -o '[^\/-]*$')"
    wget -q --spider https://dlcdn.apache.org/jena/binaries/$FUSEKI_VER.zip
    if [[ $? -ne 0 ]]; then
        FUSEKI_VER=$FUSEKI_PREV_VER
    fi

    perform_step wget https://dlcdn.apache.org/jena/binaries/$FUSEKI_VER.zip "Downloading Fuseki"
    perform_step unzip $FUSEKI_VER.zip "Unzipping Fuseki"
    perform_step rm /root/$FUSEKI_VER.zip "Removing Fuseki zip file"
    perform_step mkdir /root/ot-node/fuseki "Making /root/ot-node/fuseki directory"
    perform_step cp /root/$FUSEKI_VER/fuseki-server.jar /root/ot-node/fuseki/ "Copying Fuseki files to $OTNODE_DIR/fuseki/ 1/2"
    perform_step cp -r /root/$FUSEKI_VER/webapp/ /root/ot-node/fuseki/ "Copying Fuseki files to $OTNODE_DIR/fuseki/ 1/2"
    perform_step rm -r /root/$FUSEKI_VER "Removing the remaining /root/$FUSEKI_VER directory"
    perform_step cp $OTNODE_DIR/installer/data/fuseki.service /lib/systemd/system/ "Copying Fuseki service file"
    systemctl daemon-reload
    perform_step systemctl enable fuseki "Enabling Fuseki"
    perform_step systemctl start fuseki "Starting Fuseki"
    perform_step systemctl status fuseki "Fuseki status"
}

install_blazegraph() {
    perform_step wget https://github.com/blazegraph/database/releases/latest/download/blazegraph.jar "Downloading Blazegraph"
    perform_step cp $OTNODE_DIR/installer/data/blazegraph.service /lib/systemd/system/ "Copying Blazegraph service file"
    mv blazegraph.jar $OTNODE_DIR/../blazegraph.jar
    systemctl daemon-reload
    perform_step systemctl enable blazegraph "Enabling Blazegrpah"
    perform_step systemctl start blazegraph "Starting Blazegraph"
    perform_step systemctl status blazegraph "Blazegraph status"
}

install_sql() {
    #check which sql to install/update
    text_color $YELLOW"IMPORTANT NOTE: to avoid potential migration issues from one SQL to another, please select the one you are currently using. If this is your first installation, both choices are valid. If you don't know the answer, select [1].
    "
    while true; do
        read -p "Please select the SQL you would like to use: (Default: MySQL) [1]MySQL [2]MariaDB [E]xit " choice
        case "$choice" in
            [2]* )  text_color $GREEN"MariaDB selected. Proceeding with installation."
                    sql=mariadb
                    perform_step apt-get install curl software-properties-common dirmngr ca-certificates apt-transport-https -y "Installing mariadb dependencies"
                    curl -LsS https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | sudo bash -s -- --mariadb-server-version=10.8
                    perform_step apt-get install mariadb-server -y "Installing mariadb-server"
                    break;;
            [Ee]* ) text_color $RED"Installer stopped by user"; exit;;
            * )     text_color $GREEN"MySQL selected. Proceeding with installation."
                    sql=mysql
                    mysql_native_password=" WITH mysql_native_password"
                    perform_step apt-get install tcllib mysql-server -y "Installing mysql-server"
                    break;;
        esac
    done

    #check old sql password
    OUTPUT=$($sql -u root -e "status;" 2>&1)
    if [[ $? -ne 0 ]]; then
        while true; do
            read -s -p "Enter your old sql password: " oldpassword
            echo
            echo -n "Password check: "
            OUTPUT=$(MYSQL_PWD=$oldpassword $sql -u root -e "status;" 2>&1)
            if [[ $? -ne 0 ]]; then
                text_color $YELLOW"ERROR - The sql repository password provided does not match your sql password. Please try again."
            else
                text_color $GREEN "OK"
                break
            fi
        done
    fi

    #check operationaldb
    if [[ -d "/var/lib/mysql/operationaldb/" ]]; then
        read -p "Old operationaldb repository detected. Would you like to overwrite it ? (Default: No) [Y]es [N]o [E]xit " choice
        case "$choice" in
            [yY]* ) perform_step $(MYSQL_PWD=$oldpassword $sql -u root -e "DROP DATABASE IF EXISTS operationaldb;") "Overwritting slq repository";;
            [eE]* ) text_color $RED"Installer stopped by user"; exit;;
            * )     text_color $GREEN"Keeping previous sql repository"; NEW_DB=FALSE;;
        esac
    fi

    #check sql new password
    read -p "Would you like to change your sql password or add one ? (Default: Yes) [Y]es [N]o [E]xit " choice
    case "$choice" in
        [nN]* ) text_color $GREEN"Keeping previous sql password"; password=$oldpassword;;
        [eE]* ) text_color $RED"Installer stopped by user"; exit;;
        * )     while true; do
                    read -s -p "Enter your new sql password: " password
                    echo
                    read -s -p "Please confirm your new sql password: " password2
                    echo
                    [[ $password = $password2 ]] && break
                    text_color $YELLOW "Password entered do not match. Please try again."
                done
                perform_step $(MYSQL_PWD=$oldpassword $sql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED$mysql_native_password BY '$password';") "Changing sql password";;
    esac

    perform_step $(echo "REPOSITORY_PASSWORD=$password" > $OTNODE_DIR/.env) "Adding sql password to .env"
    if [[ $NEW_DB != FALSE ]]; then
        perform_step $(MYSQL_PWD=$password $sql -u root -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */;") "Creating new sql repository"
    fi
    if [[ $sql = mysql ]]; then
        perform_step sed -i 's|max_binlog_size|#max_binlog_size|' /etc/mysql/mysql.conf.d/mysqld.cnf "Setting max log size"
        perform_step $(echo -e "disable_log_bin\nwait_timeout = 31536000\ninteractive_timeout = 31536000" >> /etc/mysql/mysql.conf.d/mysqld.cnf) "Adding disable_log_bin, wait_timeout, interactive_timeout to sql config"
    fi
    if [[ $sql = mariadb ]]; then
        perform_step sed -i 's|max_binlog_size|#max_binlog_size|' /etc/mysql/mariadb.conf.d/50-server.cnf "Setting max log size"
        perform_step $(echo -e "disable_log_bin\nwait_timeout = 31536000\ninteractive_timeout = 31536000" >> /etc/mysql/mariadb.conf.d/50-server.cnf) "Adding disable_log_bin, wait_timeout, interactive_timeout to sql config"
    fi
    perform_step systemctl restart $sql "Restarting $sql"
}

install_node() {

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
    
    # Change directory to ot-node/current
    cd $OTNODE_DIR

    perform_step npm ci --omit=dev --ignore-scripts "Executing npm install"

    echo "NODE_ENV=mainnet" >> $OTNODE_DIR/.env

    perform_step touch $CONFIG_DIR/.origintrail_noderc "Configuring node config file"
    perform_step $(jq --null-input --arg tripleStore "$tripleStore" '{"logLevel": "trace", "auth": {"ipWhitelist": ["::1", "127.0.0.1"]}, "modules": {"tripleStore":{"defaultImplementation": $tripleStore}}}' > $CONFIG_DIR/.origintrail_noderc) "Adding tripleStore $tripleStore to node config file"

    perform_step $(jq --arg blockchain "otp" --arg evmOperationalWallet "$EVM_OPERATIONAL_WALLET" --arg evmOperationalWalletPrivateKey "$EVM_OPERATIONAL_PRIVATE_KEY" --arg evmManagementWallet "$EVM_MANAGEMENT_WALLET" --arg evmManagementWallet "$SHARES_TOKEN_NAME" --arg evmManagementWallet "$SHARES_TOKEN_SYMBOL" --arg sharesTokenName "$SHARES_TOKEN_NAME" --arg sharesTokenSymbol "$SHARES_TOKEN_SYMBOL" '.modules.blockchain.implementation[$blockchain].config |= { "evmOperationalWalletPublicKey": $evmOperationalWallet, "evmOperationalWalletPrivateKey": $evmOperationalWalletPrivateKey, "evmManagementWalletPublicKey": $evmManagementWallet, "sharesTokenName": $sharesTokenName, "sharesTokenSymbol": $sharesTokenSymbol} + .' $CONFIG_DIR/.origintrail_noderc > $CONFIG_DIR/origintrail_noderc_tmp) "Adding node wallets to node config file 1/2"
    
    perform_step mv $CONFIG_DIR/origintrail_noderc_tmp $CONFIG_DIR/.origintrail_noderc "Adding node wallets to node config file 2/2"

    perform_step cp $OTNODE_DIR/installer/data/otnode.service /lib/systemd/system/ "Copying otnode service file"
    
    systemctl daemon-reload
    perform_step systemctl enable otnode "Enabling otnode"
    perform_step systemctl start otnode "Starting otnode"
    perform_step systemctl status otnode "otnode service status"
}

#For Arch Linux installation
if [[ ! -z $(grep "arch" "/etc/os-release") ]]; then
    source <(curl -s https://raw.githubusercontent.com/OriginTrail/ot-node/v6/develop/installer/data/archlinux)
fi

#### INSTALLATION START ####
clear

cd /root

header_color $BGREEN"Welcome to the OriginTrail Installer. Please sit back while the installer runs. "

header_color $BGREEN"Installing OriginTrail node pre-requisites..."

install_prereqs

header_color $BGREEN"Preparing OriginTrail node directory..."

if [[ -d "$OTNODE_DIR" ]]; then
    read -p "Previous ot-node directory detected. Would you like to overwrite it? (Default: Yes) [Y]es [N]o [E]xit " choice
    case "$choice" in
        [nN]* ) text_color $GREEN"Keeping previous ot-node directory.";;
        [eE]* ) text_color $RED"Installer stopped by user"; exit;;
        * ) text_color $GREEN"Reconfiguring ot-node directory."; systemctl is-active --quiet otnode && systemctl stop otnode; perform_step rm -rf $OTNODE_DIR "Deleting $OTNODE_DIR"; install_directory;;
    esac
else
    install_directory
fi

OTNODE_DIR=$OTNODE_DIR/current

header_color $BGREEN"Installing Triplestore (Graph Database)..."

read -p "Please select the database you would like to use: (Default: Blazegraph) [1]Blazegraph [2]Fuseki [E]xit: " choice
case "$choice" in
    [2fF] ) text_color $GREEN"Fuseki selected. Proceeding with installation."; tripleStore=ot-fuseki;;
    [Ee] )  text_color $RED"Installer stopped by user"; exit;;
    * )     text_color $GREEN"Blazegraph selected. Proceeding with installation."; tripleStore=ot-blazegraph;;
esac

if [[ $tripleStore = "ot-fuseki" ]]; then
    if [[ -d "$OTNODE_DIR/../fuseki" ]]; then
        read -p "Previously installed Fuseki triplestore detected. Would you like to overwrite it? (Default: Yes) [Y]es [N]o [E]xit " choice
        case "$choice" in
            [nN]* ) text_color $GREEN"Keeping previous Fuseki installation.";;
            [eE]* ) text_color $RED"Installer stopped by user"; exit;;
            * )     text_color $GREEN"Reinstalling Fuseki."; perform_step rm -rf $OTNODE_DIR/../fuseki "Removing previous Fuseki installation"; install_fuseki;;
        esac
    else
        install_fuseki
    fi
fi

if [[ $tripleStore = "ot-blazegraph" ]]; then
    if [[ -f "blazegraph.jar" ]]; then
        read -p "Previously installed Blazegraph triplestore detected. Would you like to overwrite it? (Default: Yes) [Y]es [N]o [E]xit " choice
        case "$choice" in
            [nN]* ) text_color $GREEN"Keeping old Blazegraph Installation.";;
            [eE]* ) text_color $RED"Installer stopped by user"; exit;;
            * )     text_color $GREEN"Reinstalling Blazegraph."; perform_step rm -rf blazegraph* "Removing previous Blazegraph installation"; install_blazegraph;;
        esac
    else
        install_blazegraph
    fi
fi

header_color $BGREEN"Installing SQL..."

install_sql

header_color $BGREEN"Configuring OriginTrail node..."

install_node

header_color $BGREEN"INSTALLATION COMPLETE !"

text_color $GREEN "
New aliases added:
otnode-restart
otnode-stop
otnode-start
otnode-logs
otnode-config

To start using aliases, run:
source ~/.bashrc
"
text_color $YELLOW"Logs will be displayed. Press ctrl+c to exit the logs. The node WILL stay running after you return to the command prompt.

If the logs do not show and the screen hangs, press ctrl+c to exit the installation and reboot your server.

"
read -p "Press enter to continue..."

journalctl -u otnode --output cat -fn 200