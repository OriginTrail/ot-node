Local Network Setup Tool
========================

Run a single command to create an entire testing enviroment for ot-node development.

The Local Network Setup tool will start a local blockchain, deploy the required smart contracts, set up the configuration files for the nodes and start them up. From there you're ready to send API calls to your local nodes and test new features on the ot-node without worrying about funds, servers or network connectivity issues.

**Note: This tool is an internal tool used by the OriginTrail team and thus is developed for our workflow, meaning that it currently only supports MacOS**, but we encourage you to adapt it for your workflow as well.

Quick Start
===========

From the ot-node directory, run the below commands

```
    npm install
    npm run tools:lns:start
```

Usage
=====

The LNS tool deploys 4 nodes, each connected to two blockchain implementations which are running on a local ganache process.

The first node is named `DC`, while subsequent nodes are named `DH1, DH2, ...`.

You can specify to run between one and ten nodes with the `--nodes` parameter.

```
    npm run tools:lns:start -- --nodes=10
```


If you need to edit the configuration for every node, before you run the nodes you can edit the `config_template.json` file and the new configuration will be loaded during node set up.

If you want to edit a single node's configuration, you can do it in two ways:

1. Before you start the nodes, edit the `generate_config_files.js` with a specific condition. For example, if you wanted to set the fifth node to reject all offers you'd add something like the following:
```
    if (node_name === 'DH4') {
        savedConfig.blockchain.implementations[0].dh_price_factor = "10000000";
        savedConfig.blockchain.implementations[1].dh_price_factor = "10000000";
    }
```

2. Once the nodes are set up, each node has its own node configuration file in the `temporary-config-files` directory, which you can edit directly. For example, if you wanted to enable additional logs on the DC node you could add the following to `DC.json`. **Note:** After editing the the configuration this way you'll need to stop and start the node again for the changes to take effect.
```
    {
        ...
        "commandExecutorVerboseLoggingEnabled": true
    }
```


Contribution
============

OriginTrail is an open source project. We happily invite you to join us in our mission of building decentralised world of supply chain. If you would like to contribute, you are more than welcome.


### Useful links


[OriginTrail website](https://origintrail.io)

[OriginTrail documentation page](http://docs.origintrail.io)

[OriginTrail Discord Group](https://discordapp.com/invite/FCgYk2S)

[OriginTrail Telegram Group](https://t.me/origintrail)

[OriginTrail Twitter](https://twitter.com/origin_trail)

