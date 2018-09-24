#base image
FROM ubuntu:16.04
MAINTAINER OriginTrail
LABEL maintainer="OriginTrail"
ARG targetEnvironment=staging

ENV NODE_ENV=$targetEnvironment

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

# Add files
COPY . /ot-node
RUN  echo '{ "database": { "password": "root" }}' > /ot-node/.origintrail-noderc
RUN service arangodb3 start && cd /ot-node && npm install && npm run setup -- --configDir=/ot-node/data

RUN wget https://github.com/papertrail/remote_syslog2/releases/download/v0.20/remote_syslog_linux_amd64.tar.gz
RUN tar xzf ./remote_syslog_linux_amd64.tar.gz && cd remote_syslog && cp ./remote_syslog /usr/local/bin
ADD testnet/papertrail.yml /etc/log_files.yml

WORKDIR /ot-node
RUN chmod 400 testnet/start.sh

VOLUME /ot-node /var/lib/arangodb
EXPOSE 5278 8900 3000 3010
CMD ["sh", "/ot-node/testnet/start.sh"]
