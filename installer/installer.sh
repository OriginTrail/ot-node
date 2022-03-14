#!/bin/bash

OS_VERSION=$(lsb_release -sr)
GRAPHDB_FILE=$(ls /root | grep graphdb-free | grep .zip)
OTNODE_DIR="/root/ot-node"
N1=$'\n'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color


if [[ -z ${AUTO} ]]; then
  AUTO=0
fi

if [[ -z ${PUBLIC_KEY} ]]; then
  PUBLIC_KEY=$(unset)
fi

if [[ -z ${PRIVATE_KEY} ]]; then
  PRIVATE_KEY=$(unset)
fi

HELP=$(unset)

usage()
{
  echo "Usage: ot-installer [ -p | --public <publickey> ] [ -s | --secret <secretkey> ]
                        [ -a | --auto  ]
                        [ -h | --help ]"
  echo "or"
  echo "export PUBLIC_KEY=yourpublickey"
  echo "export PRIVATE_KEY=yourprivatekey"
  exit 2
}

PARSED_ARGUMENTS=$(getopt -a -n ot-installer -o p:s:ah --long public:,secret:,auto,help -- "$@")

eval set -- "$PARSED_ARGUMENTS"
while :
do
  case "$1" in
    -p | --public)   PUBLIC_KEY=$2      ; shift  2 ;;
    -s | --secret)    PRIVATE_KEY=$2       ; shift 2  ;;
    -a | --auto) AUTO=1 ; shift ;;
    -h | --help) HELP=1   ; shift ;;
    --) shift; break ;;
    *) echo "Unexpected option: $1 - this should not happen."
       usage ;;
  esac
done

if [[ $HELP == 1 ]]; then
  usage
fi

if [[ "${AUTO}" -eq 1 ]]; then
  source .env.default
  if [[ -z ${PUBLIC_KEY} || -z ${PRIVATE_KEY} ]]; then
    echo "When installer in automatic mode, you need to pass parameters or set PUBLIC_KEY and PRIVATE_KEY variable in your environment"
    usage
  fi
fi


clear

cd /root

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
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Updating Ubuntu to latest version (may take a few minutes): "

OUTPUT=$(export DEBIAN_FRONTEND=noninteractive && apt upgrade -y >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo -n "There was an error updating Ubuntu to the latest version."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing default-jre: "

OUTPUT=$(apt install default-jre unzip jq -y >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing default-jre."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Unzipping GraphDB: "
OUTPUT=$(unzip -o "$GRAPHDB_FILE" >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error unzipping GraphDB."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Copying graphdb service file: "

OUTPUT=$(cp $OTNODE_DIR/installer/data/graphdb.service /lib/systemd/system/ >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error copying the graphdb service file."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

systemctl daemon-reload

echo -n "Enable GraphDB service on boot: "

OUTPUT=$(systemctl enable graphdb >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error enabling the GraphDB service."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Starting GraphDB: "

OUTPUT=$(systemctl start graphdb >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error starting GraphDB."
    echo "$OUTPUT"
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
    echo "$OUTPUT"
    exit 1
fi

echo -n "Downloading Node.js v14: "

OUTPUT=$(wget https://deb.nodesource.com/setup_14.x >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error downloading nodejs setup."
    echo "$OUTPUT"
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
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Updating the Ubuntu repo: "

OUTPUT=$(apt update >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error updating the Ubuntu repo."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing aptitude: "

OUTPUT=$(apt install aptitude -y >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing aptitude."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing nodejs: "

OUTPUT=$(aptitude install nodejs -y >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing nodejs/npm."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Installing tcllib and mysql-server: "

OUTPUT=$(apt install tcllib mysql-server -y >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error installing tcllib and mysql-server."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Creating a local operational database: "

mysql -u root  -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */;"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error creating the database (Step 1 of 3)."
    echo "$OUTPUT"
    exit 1
fi

mysql -u root -e "update mysql.user set plugin = 'mysql_native_password' where User='root';"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error updating mysql.user set plugin (Step 2 of 3)."
    echo "$OUTPUT"
    exit 1
fi

mysql -u root -e "flush privileges;"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error flushing privileges (Step 3 of 3)."
    echo "$OUTPUT"
    exit 1
else

   echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Commenting out max_binlog_size: "

OUTPUT=$(sed -i 's|max_binlog_size|#max_binlog_size|' /etc/mysql/mysql.conf.d/mysqld.cnf >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error commenting out max_binlog_size."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Disabling binary logs: "

OUTPUT=$(echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error disabling binary logs."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Restarting mysql: "

OUTPUT=$(systemctl restart mysql >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error restarting mysql."
    echo "$OUTPUT"
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
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Opening firewall ports 22,8900,9000: "

OUTPUT=$(ufw allow 22/tcp && ufw allow 8900 && ufw allow 9000 >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error opening the firewall ports."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Enabling the firewall: "

OUTPUT=$(yes | ufw enable >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error enabling the firewall."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Adding NODE_ENV=testnet to .env: "

OUTPUT=$(echo "NODE_ENV=testnet" > .env)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error adding the env variable."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo "Creating default noderc config${N1}"

while [[ ! "$PUBLIC_KEY" =~ ^0x[a-fA-F0-9]{40}$ ]]; do
    if [[ ! "${PUBLIC_KEY}" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
      read -p "Enter the operational wallet address: " PUBLIC_KEY
    fi
done

echo "Node wallet: $PUBLIC_KEY"

# TODO: add a regex for private key
if [[ -z "${PRIVATE_KEY}" ]]; then
  read -p "Enter the private key: " PRIVATE_KEY
fi
echo "Node private key: $PRIVATE_KEY"



cp $OTNODE_DIR/.origintrail_noderc_example $OTNODE_DIR/.origintrail_noderc

jq --arg newval "$PUBLIC_KEY" '.blockchain[].publicKey |= $newval' $OTNODE_DIR/.origintrail_noderc >> $OTNODE_DIR/origintrail_noderc_temp
mv $OTNODE_DIR/origintrail_noderc_temp $OTNODE_DIR/.origintrail_noderc

jq --arg newval "$PRIVATE_KEY" '.blockchain[].privateKey |= $newval' $OTNODE_DIR/.origintrail_noderc >> $OTNODE_DIR/origintrail_noderc_temp
mv $OTNODE_DIR/origintrail_noderc_temp $OTNODE_DIR/.origintrail_noderc

echo -n "Running DB migrations: "

OUTPUT=$(npx sequelize --config=./config/sequelizeConfig.js db:migrate >/dev/null 2>&1)
if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error running the db migrations."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Copying otnode service file: "

OUTPUT=$(cp $OTNODE_DIR/installer/data/otnode.service /lib/systemd/system/ >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error copying the otnode service file."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

systemctl daemon-reload

echo -n "Enable otnode service on boot: "

OUTPUT=$(systemctl enable otnode >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error enabling the otnode service."
    echo "$OUTPUT"
    exit 1
else
    echo -e "${GREEN}SUCCESS${NC}"
fi

echo -n "Starting otnode: "

OUTPUT=$(systemctl start otnode >/dev/null 2>&1)

if [[ $? -ne 0 ]]; then
    echo -e "${RED}FAILED${NC}"
    echo "There was an error starting the node."
    echo "$OUTPUT"
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
    echo "$OUTPUT"
    exit 1
fi

echo -n "Logs will be displayed. Press ctrl+c to exit the logs. The node WILL stay running after you return to the command prompt."
echo " "

if [[ "${AUTO}" == 0 || -z "${AUTO}" ]]; then
  read -p "Press enter to continue..."
fi

journalctl -u otnode --output cat -fn 100
