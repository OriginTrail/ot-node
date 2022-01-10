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
ARG PASSWORD=password
RUN apt-get install -y lsb-release
RUN apt-get install -y wget gnupg curl
RUN curl -LO https://dev.mysql.com/get/mysql-apt-config_0.8.20-1_all.deb
RUN dpkg -i ./mysql-apt-config_0.8.20-1_all.deb

RUN { \
     echo mysql-server mysql-server/root_password password $PASSWORD ''; \
     echo mysql-server mysql-server/root_password_again password $PASSWORD ''; \
} | debconf-set-selections \
    && apt-get update && apt-get install -y default-mysql-server default-mysql-server-core



#Install forerver and nodemon
RUN npm install forever -g
RUN npm install nodemon -g



WORKDIR /ot-node/current

COPY . .

#Install nppm
RUN npm install
RUN npm ci --only=production
RUN npm install --save form-data



#RUN usermod -d /var/lib/mysql/ mysql
#RUN echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf
RUN service mariadb start && mysql -u root  -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */; SET PASSWORD FOR root@localhost = PASSWORD(''); FLUSH PRIVILEGES;" && npx sequelize --config=./config/sequelizeConfig.js db:migrate

