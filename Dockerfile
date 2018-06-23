#base image
FROM ubuntu:16.04
MAINTAINER OriginTrail

RUN apt-get -qq update && apt-get -qq -y install curl
RUN curl -sL https://deb.nodesource.com/setup_9.x |  bash -
RUN apt-get -qq update && apt-get -qq -y install wget apt-transport-https software-properties-common build-essential git nodejs sqlite unzip
RUN add-apt-repository -y ppa:ethereum/ethereum && apt-get -qq update && apt-get install -y -qq ethereum geth
#ArangoDB
ADD testnet/install-arango.sh /install-arango.sh
RUN ["chmod", "+x", "/install-arango.sh"]
RUN /install-arango.sh

RUN export LC_ALL=C

RUN apt-get update && apt install -y -qq supervisor
RUN mkdir -p /var/log/supervisor
COPY testnet/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

#Clone the project
RUN wget https://codeload.github.com/OriginTrail/ot-node/zip/docker
RUN unzip docker -d . && rm docker && mv ot-node-docker ot-node

COPY package.json /tmp/package.json
RUN cd /tmp && npm install
RUN cp -a /tmp/node_modules /ot-node

WORKDIR /ot-node
RUN mkdir keys data &> /dev/null
RUN cp .env.example .env

EXPOSE 5278 80 443 5279 8900 8529 3000
CMD ["/ot-node/testnet/start.sh"]
