# DKG local network setup tool

This tool will help you set up a local DKG v6 network running with the Hardhat blockchain. It is useful for development and testing purposes and is used internally by the OriginTrail core developers.
<br/>

**Note: This tool is an internal tool used by the OriginTrail team and thus is developed for our workflow, meaning that it currently only supports MacOS**, but we encourage you to adapt it for your workflow as well.

# Prerequisites

-   An installed and running triplestore (graph database)
    -   We recommend testing with Blazegraph. In order to download Blazegraph, please visit their official [website](https://blazegraph.com/). Alternatively other triple stores can be used (GraphBD, Apache Jena and other RDF native graph databases)
-   An installed and running MySQL server
-   You should have installed npm and Node.js (v16) or higher

# Setup instructions

In order to run the local network you fist need to clone the "ot-node" repository.
<br/>

## 1. CLONE OT-NODE REPOSITORY & INSTALL DEPENDENCIES

After cloning the **ot-node** repository, please checkout to "v6/develop" branch and install dependencies by running:

```bash
git clone https://github.com/OriginTrail/ot-node.git && cd ot-node/ && npm install && cd ..
```

<br/>

### 2.2 Create the .env file inside the "ot-node" directory:

```bash
nano .env
```

and paste the following content inside (save and close):

```bash
NODE_ENV=development
RPC_ENDPOINT_BC1=http://localhost:8545
RPC_ENDPOINT_BC2=http://localhost:9545
PRIVATE_KEY=02b39cac1532bef9dba3e36ec32d3de1e9a88f1dda597d3ac6e2130aed9adc4e
```

**Note:** The private key above is used ONLY for convenience and SHOULD be changed to a secure key when used in production.
<br/>

## 3. START THE LOCAL NETWORK

## Specifying the number of nodes

You can specify to run anywhere between one and twenty nodes with the `--nodes` parameter.

**Note:** All nodes assume MySQL username root and no password. To change the MySQL login information update the .origintrail_noderc template file sequelize-repository config object with your username and password<br/>

The first node will be named `bootstrap`, while subsequent nodes will be named `dh1, dh2, ...`. <br/>

```bash
bash ./tools/local-network-setup/setup-macos-environment.sh --nodes=6
```

**Note:** With the above command, we will start two hardhat instances, deploy contracts, deploy a 6 nodes network (1 bootstrap and 5 subsequent nodes)<br/>

## Specifying the blockchain network

You can specify the blockchain network you want to connect to with `--network` parameter.
Available networks:

-   hardhat - default network

# Contribution

OriginTrail is an open source project. We happily invite you to join us in our mission of building decentralized knowledge graph - we're excited for your contributions! Join us in discord to meet the dev community

### Useful links

[OriginTrail website](https://origintrail.io)

[OriginTrail documentation page](http://docs.origintrail.io)

[OriginTrail Discord Group](https://discordapp.com/invite/FCgYk2S)

[OriginTrail Telegram Group](https://t.me/origintrail)

[OriginTrail Twitter](https://twitter.com/origin_trail)
