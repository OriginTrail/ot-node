Local Network Setup Tool
========================

#### Run a single command to create an entire testing environment for ot-node development.

The Local Network Setup tool will  set up the configuration files for the nodes and start the nodes in separate windows.
From there you're ready to send API calls to your local nodes and test new features on the ot-node.

**Note: This tool is an internal tool used by the OriginTrail team and thus is developed for our workflow, meaning that it currently only supports MacOS**, but we encourage you to adapt it for your workflow as well.

Quick Start
===========

## Prerequisites


* An installed and running GraphDB
  * In order to download GraphDB, please visit their official website and fill out a form. Installation files will be provided to you via email.
* An installed and running MySQL 
  * You need to create empty table named operationaldb inside MySQL
* You should have installed npm and Node.js (v14) or higher
* You should have ot-node dependencies installed with the `npm install` command
* You should have run db migrations: 
  * `npx sequelize --config=./config/sequelizeConfig.js db:migrate`
* generate a .env file in the ot-node root folder and add public, private keys for polygon blockchain and operational database password for root user (optional, default password is empty string):
```dotenv
NODE_ENV=development
PUBLIC_KEY=<insert_here>
PRIVATE_KEY=<insert_here>
MANAGEMENT_KEY=<insert_here>
OPERATIONAL_DB_PASSWORD=<insert_password_here>
```



## How to start

From the ot-node directory, run the below command

```bash
bash setup-macos-environment.sh
```

Usage
=====

## Specifying the number of nodes

The LNS tool deploys 4 nodes, each connected to Polygon Mumbai testnet.
You can specify to run anywhere between one and ten nodes with the `--nodes` parameter.

```bash
bash setup-macos-environment.sh --nodes=10
```

The first node will be named `bootstrap`, while subsequent nodes will be named `dh1, dh2, ...`.

Contribution
============

OriginTrail is an open source project. We happily invite you to join us in our mission of building decentralized knowledge graph. If you would like to contribute, you are more than welcome.


### Useful links


[OriginTrail website](https://origintrail.io)

[OriginTrail documentation page](http://docs.origintrail.io)

[OriginTrail Discord Group](https://discordapp.com/invite/FCgYk2S)

[OriginTrail Telegram Group](https://t.me/origintrail)

[OriginTrail Twitter](https://twitter.com/origin_trail)

