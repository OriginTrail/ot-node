#base image
FROM node:14.18.3-bullseye

MAINTAINER OriginTrail
LABEL maintainer="OriginTrail"
ENV NODE_ENV=testnet


#Mysql-server installation
ARG DEBIAN_FRONTEND=noninteractive
ARG PASSWORD=password
RUN apt-get update
RUN apt-get install -y lsb-release
RUN apt-get install -y wget gnupg curl
RUN curl -LO https://dev.mysql.com/get/mysql-apt-config_0.8.20-1_all.deb
RUN dpkg -i ./mysql-apt-config_0.8.20-1_all.deb
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 467B942D3A79BD29


RUN { \
     echo mysql-server mysql-server/root_password password $PASSWORD ''; \
     echo mysql-server mysql-server/root_password_again password $PASSWORD ''; \
} | debconf-set-selections \
    && apt-get update && apt-get install -y default-mysql-server default-mysql-server-core



RUN apt-get -qq -y install git
RUN apt-get -qq -y install make python

#Install Papertrail
RUN wget https://github.com/papertrail/remote_syslog2/releases/download/v0.20/remote_syslog_linux_amd64.tar.gz
RUN tar xzf ./remote_syslog_linux_amd64.tar.gz && cd remote_syslog && cp ./remote_syslog /usr/local/bin
COPY config/papertrail.yml /etc/log_files.yml






#Install forever
RUN npm install forever -g




WORKDIR /ot-node

COPY . .

#Install nppm
RUN npm install

#Mysql intialization
RUN service mariadb start && mysql -u root  -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */; SET PASSWORD FOR root@localhost = PASSWORD(''); FLUSH PRIVILEGES;"

