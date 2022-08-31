#base image
FROM ubuntu:20.04

MAINTAINER OriginTrail
LABEL maintainer="OriginTrail"
ENV NODE_ENV=testnet

#Install git, nodejs, mysql, python
RUN apt-get -qq update && apt-get -qq -y install curl
RUN curl -sL https://deb.nodesource.com/setup_14.x |  bash -
RUN apt-get -qq update
RUN apt-get -qq -y install wget apt-transport-https
RUN apt-get -qq -y install git nodejs
RUN apt update && DEBIAN_FRONTEND=noninteractive apt install -y --no-install-recommends mysql-server
RUN apt-get -qq -y install unzip nano
RUN apt-get -qq -y install make python

#Install Papertrail
RUN wget https://github.com/papertrail/remote_syslog2/releases/download/v0.20/remote_syslog_linux_amd64.tar.gz
RUN tar xzf ./remote_syslog_linux_amd64.tar.gz && cd remote_syslog && cp ./remote_syslog /usr/local/bin
COPY config/papertrail.yml /etc/log_files.yml



#Install forever
RUN npm install -g forever


WORKDIR /ot-node

COPY . .


#Install npm
RUN npm install


#Intialize mysql
RUN usermod -d /var/lib/mysql/ mysql
RUN echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf
RUN service mysql start && mysql -u root  -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */; update mysql.user set plugin = 'mysql_native_password' where User='root'/*\!40100 DEFAULT CHARACTER SET utf8 */; flush privileges;" && npx sequelize --config=./config/sequelizeConfig.js db:migrate

