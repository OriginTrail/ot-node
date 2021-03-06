# Warp testnet setup instructions

## About Warp testnet

The Warp testnet is the first deployment of the OriginTrail multi-chain network, utilized for beta testing of the ot-node v5 codebase. It operates with two distinct Ethereum testnet blockchains, Kovan and Rinkeby. The goal of Warp is to establish a relevant environment for testing the new implementation of ot-node blockchain services, reaching the ot-node technology readiness level 8 (TRL8) which indicates system completeness. The OriginTrail core development team invites all current node runners and anyone else interested to contribute to testing by running a Warp node and forwarding relevant logs to the OriginTrail team.

Read more in the blogpost [here](https://medium.com/origintrail/staking-for-the-worlds-first-multi-chain-decentralized-knowledge-graph-828573a2ef95) and dedicated OT-RFC [here](https://github.com/OriginTrail/OT-RFC-repository/blob/main/RFCs/OT-RFC%2008%20-%20OT%20Node%20Blockchain%20Service%20Module%20specification%20V1.pdf).

## Read me first

Please keep in mind that we will give our best to support you while setting up and testing the nodes. Some features are subject to change and we are aware that some defects may show up on different installations and usage scenarios.

If you need help installing OT Node or troubleshooting your installation, you can either:

-   engage in our [Discord](https://discord.com/invite/FCgYk2S) community and post your question in #instaling-a-node channel,
    
-   contact us directly via email at [tech@origin-trail.com](mailto:tech@origin-trail.com), with [Warp testnet] added to the beginning of the subject line.
    

Nodes can be installed in two ways:

-   via docker, which is a recommended way, also explained on our website
    
-   manually
    

## Hardware requirements

The recommended minimum specifications are 2.2GHz CPU, and 2GB RAM with at least 20 GB of storage space.

## General setup parameters

### Blockchain networks supported:

Rinkeby, Kovan

### Network ID:

warp-testnet

**Rinkeby hub contract address:**

    0x1107BDdDC52a15FA3Dd8d38A6174bBc30fc5714A

**Kovan hub contract address:**

    0x8623917Fba97BdfDA15E9a175e248Cd4cC6F6f39

## Funding management

You can start your node to listen for jobs on Rinkeby, Kovan or both blockchain networks. Your operational wallet needs to have:

### Rinkeby network - 5000 ATRAC:

-   3000 ATRAC as minimum stake + 2000 ATRAC for starting new jobs.
    
-   0.2 Rinkeby ETH
    
### Kovan network
    
-   3000 KTRAC as minimum stake + 2000 KTRAC for starting new jobs.
    
-   0.2 Kovan ETH
    

### ATRAC faucet
    
-   Please contact @Nikita_Abrashkin on Discord
    

### KTRAC faucet
    

-   Please contact @Nikita_Abrashkin on Discord
    

### Rinkeby ETH faucet:

-   [https://faucet.rinkeby.io/](https://faucet.rinkeby.io/)
	
### Kovan ETH faucet:
    

-   https://faucet.kovan.network/
    

## Installation via Docker

### Public IP or open communication

A public IP address, domain name, or open network communication with the Internet is required. If behind NAT, please manually setup port forwarding to all the node’s ports.

### Docker installed

The host machine needs to have Docker installed to be able to run the Docker commands specified below. You can find instructions on how to install Docker here:

-   For Mac [https://docs.docker.com/docker-for-mac/install/](https://docs.docker.com/docker-for-mac/install/)
    
-   For Windows [https://docs.docker.com/docker-for-windows/install/](https://docs.docker.com/docker-for-windows/install/)
    
-   For Ubuntu [https://docs.docker.com/install/linux/docker-ce/ubuntu/](https://docs.docker.com/install/linux/docker-ce/ubuntu/)
    

It is strongly suggested to use the latest official version.

### Open Ports

By default Docker container will use 8900, 5278 and 3000 ports. These can be mapped differently in Docker container initialization command. Make sure they’re not blocked by your firewall and that they are open to the public.

Please note: port 8900 is used for REST API access which is not available until OT node is fully started. This can be concluded after the following log message is displayed in the running node.

## Configuration

There’s a minimum set of config parameters that need to be provided in order to run a node, without which the node will refuse to start. You can use the node configuration template and just update necessary parameters.

### Node configuration template
<pre>
{
    "network": {
        "id": "warp-testnet",
        "bootstraps": [
            "https://testnet-warp-do-bootstrap.origin-trail.network:5278/#4ddb6dd5a161b8e1ac788d0b674d2a728fd74f68",
            "https://testnet-warp-aws-bootstrap.origintrail.network:5278/#b78edd9458c2224925fbce09d5312e82267f57d7"
        ],
        "remoteWhitelist": [
           **remote_whitelist**
        ],
        "hostname": "**node_hostname**"
    },
    "initial_deposit_amount": "5000000000000000000000",
    "litigationEnabled": true,
    "blockchain": {
        "implementations": [
            {
                "blockchain_title": "Ethereum",
                "network_id": "rinkeby",
                "identity_filepath": "rinkeby_identity.json",
                "hub_contract_address": "0x1107BDdDC52a15FA3Dd8d38A6174bBc30fc5714A",
                "node_wallet": "**node_wallet**",
                "node_private_key": "**node_private_key**",
                "management_wallet": "**management_wallet**",
                "rpc_server_url": "**rpc_server_url_rinkeby**",
                "gas_price": "1000000000",
                "gas_limit": "2000000"
            },
            {
                "blockchain_title": "Ethereum",
                "network_id": "kovan",
                "identity_filepath": "kovan_identity.json",
                "hub_contract_address": "0x8623917Fba97BdfDA15E9a175e248Cd4cC6F6f39",
                "node_wallet": "**node_wallet**",
                "node_private_key": "**node_private_key**",
                "management_wallet": "**management_wallet**",
                "rpc_server_url": "**rpc_server_url_kovan**",
                "gas_price": "1000000000",
                "gas_limit": "2000000"
            }
        ]
    },
    "dc_choose_time": 300000,
    "autoUpdater": {
        "enabled": true,
        "packageJsonUrl": "https://raw.githubusercontent.com/OriginTrail/ot-node/feature/blockchain-service/package.json",
        "archiveUrl": "https://github.com/OriginTrail/ot-node/archive/feature/blockchain-service.zip"
    }
}
</pre>

### What needs to be provided in the template:

In the previously downloaded template please provide inputs for the following:

1.  `**node_hostname**` - the public network address or hostname that will be used in P2P communication with other nodes for node’s self identification.
    
2.  `**remote_whitelist**` - list of IPs or hosts of the machines (“host.domain.com”) that are allowed to communicate with REST API.
    
3.  `**rpc_server_url_rinkeby**, **rpc_server_url_kovan**` - an URL to RPC host server, usually Infura or own hosted Geth server. For more see RPC server host
    
4.  `**node_wallet**`, `**node_private_key**` - operational wallet Ethereum wallet address and its private key

5.  `**management_wallet**` - the management wallet for your node (note: the Management wallet private key is NOT stored on the node)
    

## Running a node on the WARP TESTNET Network

Let’s just point Docker to the right image and configuration file with the following command:

  
<pre>
docker run --log-driver json-file --log-opt max-size=1g --name=otnode 
--hostname=**node_hostname** -p 8900:8900 -p 5278:5278 -p 3000:3000 -e 
LOGS_LEVEL_DEBUG=1 -e SEND_LOGS=1 -v ~/certs/:/ot-node/certs/ 
-v ~/.origintrail_noderc:/ot-node/.origintrail_noderc 
quay.io/origintrail/otnode-test:feature_blockchain-service
</pre>
  

### Note:
Please make sure that your .origintrail_noderc file is ready before running the following commands. In this example, the configuration file .origintrail_noderc is placed into the home folder of the current user (ie. /home/ubuntu). You should point to the path where you created .origintrail_noderc on your file system.

## Congratulations

You have successfully installed the Warp testnet node!

  

## Useful commands

#### OT Node Status

To check if it is running in Terminal, run the following command:

    docker ps

This command will show if your node is running.

#### Starting OT Node

This command will start your node as a background process.

    docker start otnode

  

This command will start your node in interactive mode and you will see the node’s process written in the terminal, but this command will not run your node as a background process, which means your node will stop if you close your Terminal/Console.

    docker start -i otnode

Note: By using this command, you will be able to see your Houston password in the terminal.

  

## Stopping OT Node

You can stop your node in the following two ways:

1 - If you started your node with the docker start otnode command and you wish to stop it from running, use the following command in your terminal:

    docker stop otnode

  

2 - If you started your node by using the docker start -i otnode command, you can stop it either by closing the Terminal or simply by pressing the ctrl + c.
