#!bin/bash
curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
sudo apt-get install -y nodejs

wget https://www.arangodb.com/repositories/arangodb3/xUbuntu_16.04/Release.key
sudo apt-key add Release.key
sudo apt-add-repository 'deb https://www.arangodb.com/repositories/arangodb3/xUbuntu_16.04/ /'
sudo apt-get update -y
echo arangodb3 arangodb3/password password root | debconf-set-selections
echo arangodb3 arangodb3/password_again password root | debconf-set-selections
sudo apt-get install arangodb3
sudo apt-get install sqlite3

export LC_ALL=C

sudo apt-get install -y python3-pip

sudo pip3 install python-arango
sudo pip3 install xmljson
sudo pip3 install python-dotenv

echo "Installing Java 8 as user `whoami` "

sudo echo "deb http://ppa.launchpad.net/webupd8team/java/ubuntu trusty main" | tee /etc/apt/sources.list.d/webupd8team-java.list
sudo echo "deb-src http://ppa.launchpad.net/webupd8team/java/ubuntu trusty main" | tee -a /etc/apt/sources.list.d/webupd8team-java.list

# Accept license non-iteractive
sudo echo oracle-java8-installer shared/accepted-oracle-license-v1-1 select true | sudo /usr/bin/debconf-set-selections
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys EEA14886
sudo apt-get update
sudo apt-get install -y oracle-java8-installer

# Make sure Java 8 becomes default java
sudo apt-get install -y oracle-java8-set-default

# Install Neo4j
wget --no-check-certificate -O - https://debian.neo4j.org/neotechnology.gpg.key | sudo apt-key add -
sudo echo 'deb http://debian.neo4j.org/repo stable/' | sudo tee /etc/apt/sources.list.d/neo4j.list
sudo apt update -y
sudo apt install neo4j
sudo service neo4j start

sudo apt-get install git

git clone -b master https://github.com/OriginTrail/ot-node.git
cd ot-node
mkdir keys data &> /dev/null
cp .env.example .env

npm install
echo "Installation complete. Please configure .env file."