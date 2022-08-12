Local Network Setup Tool
========================

The Local Network Setup tool will  set up the configuration files for the nodes and start the nodes in separate windows.
From there you're ready to send API calls to your local nodes and test new features on the ot-node.<br/>


**Note: This tool is an internal tool used by the OriginTrail team and thus is developed for our workflow, meaning that it currently only supports MacOS**, but we encourage you to adapt it for your workflow as well.

**Nodes will be deployed to Ganache network which is a personal blockchain for application development.**



Prerequisites
=============


* An installed and running tripplestore database
  * We suggest using GraphDB. In order to download GraphDB, please visit their official [website](https://graphdb.ontotext.com/) and fill out a form. Installation files will be provided to you via email.
* An installed and running MySQL 
  * You need to create empty table named "operationaldb" inside MySQL
* You should have installed npm and Node.js (v16) or higher


# Setup instructions

In order to run the local network you fist need to clone the "ot-node" and "dkg-evm-module" repositories.
<br/>

## 1. CLONE OT-NODE REPOSITORY & INSTALL DEPENDENCIES
After cloning the **ot-node** repository, please checkout to "v6/refactor/develop" branch and install dependencies by running:
```bash
git clone https://github.com/OriginTrail/ot-node.git && cd ot-node/ && git checkout v6/refactor/develop && npm install
```
<br/>

## 2. CLONE DKG REPOSITORIES & INSTALL DKG SMART CONTRACT DEPENDENCIES
**Note:** DO NOT clone **dkg-evm-module** repository inside of the **ot-node** directory. 

After cloning the **dkg-evm-module** repository:
```bash
git clone https://github.com/OriginTrail/dkg-evm-module.git
```

install dependencies with:
```bash
npm install
```

and run local Ganache by executing:
```bash
npm run ganache
```
<br/>


### 2.2 Create the .env file inside the "dkg-evm-module" directory and deploy DKG smart contract:
```bash
nano .env
```
and paste the following content inside (save and close):
```bash
ACCESS_KEY = http://localhost:7545 
PRIVATE_KEY = 02b39cac1532bef9dba3e36ec32d3de1e9a88f1dda597d3ac6e2130aed9adc4e
```
**Note:** The private key above is used ONLY for convenience and SHOULD be changed to a secure key when used in production. 

After preparing the .env file, deploy DKG smart contracts by executing the following command:
```bash
npm run deploy 
```
<br/>

## 3. START LOCAL NETWORK

## Specifying the number of nodes
You can specify to run anywhere between one and ten nodes with the `--nodes` parameter.

The first node will be named `bootstrap`, while subsequent nodes will be named `dh1, dh2, ...`. <br/>

```bash
bash ./tools/local-network-setup/setup-macos-environment.sh --nodes=6
```
**Note:** With the above command, we will deploy a 6 nodes network (1 bootstrap and 5 subsequent nodes)<br/>

<br/>

Contribution
============

OriginTrail is an open source project. We happily invite you to join us in our mission of building decentralized knowledge graph. If you would like to contribute, you are more than welcome.


### Useful links


[OriginTrail website](https://origintrail.io)

[OriginTrail documentation page](http://docs.origintrail.io)

[OriginTrail Discord Group](https://discordapp.com/invite/FCgYk2S)

[OriginTrail Telegram Group](https://t.me/origintrail)

[OriginTrail Twitter](https://twitter.com/origin_trail)

