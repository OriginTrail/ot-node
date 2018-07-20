#base image
FROM ubuntu:16.04
MAINTAINER OriginTrail

RUN apt-get -qq update && apt-get -qq -y install curl
RUN curl -sL https://deb.nodesource.com/setup_9.x |  bash -
RUN apt-get -qq update && apt-get -qq -y install wget apt-transport-https software-properties-common build-essential git nodejs sqlite unzip nano
RUN add-apt-repository -y ppa:ethereum/ethereum && apt-get -qq update && apt-get install -y -qq ethereum geth
#ArangoDB
ADD testnet/install-arango.sh /install-arango.sh
RUN ["chmod", "+x", "/install-arango.sh"]
RUN /install-arango.sh

RUN export LC_ALL=C

RUN apt-get update && apt install -y -qq supervisor
RUN mkdir -p /var/log/supervisor
COPY testnet/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY package.json /tmp/package.json
RUN cd /tmp && npm install

RUN wget https://github.com/papertrail/remote_syslog2/releases/download/v0.20/remote_syslog_linux_amd64.tar.gz

RUN tar xzf ./remote_syslog_linux_amd64.tar.gz && cd remote_syslog && cp ./remote_syslog /usr/local/bin
ADD testnet/papertrail.yml /etc/log_files.yml
#Clone the project
RUN wget https://codeload.github.com/OriginTrail/ot-node/zip/develop
RUN unzip develop -d . && rm develop && mv ot-node-develop ot-node

RUN cp -a /tmp/node_modules /ot-node

WORKDIR /ot-node
RUN mkdir keys data &> /dev/null
RUN cp .env.example .env
COPY testnet/start.sh /ot-node/testnet/start.sh
RUN chmod 400 testnet/start.sh

EXPOSE 5278 8900 3000 4043 3010
CMD ["sh", "/ot-node/testnet/start.sh"]
