FROM alpine:latest
MAINTAINER OriginTrail

#WORKDIR /app
#VOLUME /app

RUN apk add --update mysql mysql-client && rm -f /var/cache/apk/*

# These lines moved to the end allow us to rebuild image quickly after only these files were modified.
COPY ./config/alpine-MySQL.sh /alpine-MySQL.sh

ARG MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
ARG MYSQL_USER=${MYSQL_USER}
ARG MYSQL_PASSWORD=${MYSQL_PASSWORD}
ARG MYSQL_DATABASE=operationaldb 


#EXPOSE 3306
CMD ["/alpine-MySQL.sh"]