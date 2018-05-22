#!bin/bash
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs

db=arangodb

for i in "$@"
do
case $i in
    --db=*|--database=*)
    db="${i#*=}"
    shift # past argument=value
    ;;
esac
done

if [ -z "$db" ]; then
  echo "Parameter expected."
  exit 1
fi

if [ $db != "arangodb" ] && [ $db != "neo4j" ] ; then
    echo "Invalid database: arangodb or neo4j expected."
    exit 1
fi

if [ $db = "arangodb" ]; then
  wget https://www.arangodb.com/repositories/arangodb3/xUbuntu_16.04/Release.key
  sudo apt-key add Release.key
  sudo apt-add-repository 'deb https://www.arangodb.com/repositories/arangodb3/xUbuntu_16.04/ /'
  sudo apt-get update -y
  echo arangodb3 arangodb3/password password root | debconf-set-selections
  echo arangodb3 arangodb3/password_again password root | debconf-set-selections
  sudo apt-get install arangodb3
fi

if [ $db = "neo4j" ]; then
  sudo add-apt-repository ppa:webupd8team/java
  sudo apt-get update
  sudo apt-get install oracle-java8-installer
  wget -O - https://debian.neo4j.org/neotechnology.gpg.key | sudo apt-key add -
  echo 'deb https://debian.neo4j.org/repo stable/' | sudo tee /etc/apt/sources.list.d/neo4j.list
  sudo apt-get update
  sudo apt-get install neo4j
fi

sudo apt-get install sqlite3

export LC_ALL=C

sudo apt-get install -y python3-pip

sudo pip3 install python-arango
sudo pip3 install xmljson
sudo pip3 install python-dotenv

sudo apt-get install git

git clone -b master https://github.com/OriginTrail/ot-node.git
cd ot-node
mkdir keys data &> /dev/null
cp .env.example .env

npm install
echo "Installation complete. Please configure .env file."