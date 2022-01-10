#base image
FROM debian:bullseye

MAINTAINER OriginTrail
LABEL maintainer="OriginTrail"
ENV NODE_ENV=testnet

#Install git, nodejs,python
RUN apt-get -qq update && apt-get -qq -y install curl
RUN curl -sL https://deb.nodesource.com/setup_14.x |  bash -
RUN apt-get -qq update
RUN apt-get -qq -y install wget apt-transport-https
RUN apt-get -qq -y install git nodejs
RUN apt-get -qq -y install make python

#supervisor install
RUN apt-get update && apt install -y -qq supervisor
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf



#Mysql-server installation
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get -qq -y install wget
RUN apt-get -qq -y install lsb-release gnupg
RUN apt-get -qq install sudo
RUN wget http://repo.mysql.com/mysql-apt-config_0.8.10-1_all.deb
RUN sudo -E apt install ./mysql-apt-config_0.8.10-1_all.deb
RUN apt-get -qq --allow-insecure-repositories update
RUN sudo -E apt install -y mysql-server --allow-unauthenticated



#Install forerver and nodemon
RUN npm install forever -g
RUN npm install nodemon -g



WORKDIR /ot-node/current

COPY . .

#Install nppm
RUN npm install
RUN npm ci --only=production
RUN npm install --save form-data




#Intialize mysql
RUN usermod -d /var/lib/mysql/ mysql
RUN echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf
RUN service mysql start && mysql -u root  -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */; update mysql.user set plugin = 'mysql_native_password' where User='root'/*\!40100 DEFAULT CHARACTER SET utf8 */; flush privileges;" && npx sequelize --config=./config/sequelizeConfig.js db:migrate

