import {fork} from "child_process";
const otNodeProcessPath =  './test/bdd/steps/lib/ot-node-process.mjs';

function getBlockchainConfiguration(localBlockchain, privateKey, publicKey, managementKey) {
    return [
        {
            defaultImplementation: 'ganache',
            implementation: {
                ganache: {
                    config: {
                        blockchainTitle: 'ganache',
                        networkId: 'ganache::testnet',
                        rpcEndpoints: ['http://localhost:7545'],
                        hubContractAddress: localBlockchain.getHubAddress(),
                        evmOperationalWalletPublicKey: publicKey,
                        evmOperationalWalletPrivateKey: privateKey,
                        evmManagementWalletPublicKey: managementKey,
                        evmManagementPublicKey: managementKey,
                    },
                },
            },
        },
    ];
}

export function forkNode(nodeConfiguration) {
    const forkedNode = fork(otNodeProcessPath, [], { silent: true });
    forkedNode.send(JSON.stringify(nodeConfiguration));
    return forkedNode;
}

export function createNodeConfiguration(wallet, managementWallet, nodeIndex, nodeName, rpcPort) {
    return {
        modules: {
            blockchain: getBlockchainConfiguration(
                this.state.localBlockchain,
                wallet.privateKey,
                wallet.address,
                managementWallet.address,
            )[0],
            network: {
                implementation: {
                    'libp2p-service': {
                        config: {
                            port: 9001 + nodeIndex,
                        },
                    },
                },
            },
            repository: {
                implementation: {
                    'sequelize-repository': {
                        config: {
                            database: `operationaldbnode${nodeIndex}`,
                        },
                    },
                },
            },
            tripleStore: {
                implementation: {
                    'ot-graphdb': {
                        config: {
                            repository: nodeName,
                        },
                    },
                },
            },
            httpClient: {
                implementation: {
                    'express-http-client': {
                        config: {
                            port: rpcPort,
                        },
                    },
                },
            },
        },
        operationalDatabase: {
            databaseName: `operationaldbnode${nodeIndex}`,
        },
        rpcPort,
        appDataPath: `data${nodeIndex}`,
        graphDatabase: {
            name: nodeName,
        },
    };
}