#base image
FROM ubuntu:20.04

MAINTAINER OriginTrail
LABEL maintainer="OriginTrail"


RUN apt-get -qq update && apt-get -qq -y install curl
RUN curl -sL https://deb.nodesource.com/setup_14.x |  bash -
RUN apt-get -qq update
RUN apt-get -qq -y install wget apt-transport-https
RUN apt-get -qq -y install git nodejs
RUN apt-get -qq -y install mysql-server unzip nano
RUN apt-get -qq -y install make python




RUN apt-get update && apt install -y -qq supervisor
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN npm install forever -g
RUN npm install nodemon -g

WORKDIR /ot-node/current

COPY package*.json ./

RUN npm install
RUN npm ci --only=production


COPY . .


RUN wget https://github.com/papertrail/remote_syslog2/releases/download/v0.20/remote_syslog_linux_amd64.tar.gz
RUN tar xzf ./remote_syslog_linux_amd64.tar.gz && cd remote_syslog && cp ./remote_syslog /usr/local/bin
ADD config/papertrail.yml /etc/log_files.yml

RUN usermod -d /var/lib/mysql/ mysql
RUN echo "disable_log_bin" >> /etc/mysql/mysql.conf.d/mysqld.cnf
RUN service mysql start && mysql -u root  -e "CREATE DATABASE operationaldb /*\!40100 DEFAULT CHARACTER SET utf8 */; update mysql.user set plugin = 'mysql_native_password' where User='root'/*\!40100 DEFAULT CHARACTER SET utf8 */; flush privileges;" && npx sequelize --config=./config/sequelizeConfig.js db:migrate


# Graphdb 7200
# Libp2p 8900
# RPC 9000
EXPOSE 3306
EXPOSE 8900
EXPOSE 9000
CMD ["/usr/bin/supervisord", "-c", "/ot-node/current/supervisord.conf"]

