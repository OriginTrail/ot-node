#base image
FROM debian:bullseye-slim

MAINTAINER OriginTrail
LABEL maintainer="OriginTrail"
ENV NODE_ENV=testnet

#Install git, nodejs, mysql, python
RUN apt-get -qq update && apt-get -qq -y install curl
RUN curl -sL https://deb.nodesource.com/setup_14.x |  bash -
RUN apt-get -qq update
RUN apt-get -qq -y install wget apt-transport-https
RUN apt-get -qq -y install git nodejs
RUN apt-get -qq -y install mysql-server unzip nano
RUN apt-get -qq -y install make python



#supervisor install
RUN apt-get update && apt install -y -qq supervisor
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

#Install forerver and nodemon
RUN npm install forever -g
RUN npm install nodemon -g

#Copyping origintrail_nodeirc to image
ADD .origintrail_noderc_example /ot-node/current/.origintrail_noderc

WORKDIR /ot-node/current

COPY package*.json ./

#Install nppm
RUN npm install
RUN npm ci --only=production
RUN npm install --save form-data

COPY . .

#Intialize mysql
RUN usermod -d /var/lib/mysql/ mysql
RUN echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf
RUN service mysql start && mysql -u root  -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */; update mysql.user set plugin = 'mysql_native_password' where User='root'/*\!40100 DEFAULT CHARACTER SET utf8 */; flush privileges;" && npx sequelize --config=./config/sequelizeConfig.js db:migrate

#Expose ports
# Graphdb 7200
# Libp2p 8900
# RPC 9000
EXPOSE 3306
EXPOSE 8900
EXPOSE 9000
