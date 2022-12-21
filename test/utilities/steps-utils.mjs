import {fork} from "child_process";
const otNodeProcessPath =  './test/bdd/steps/lib/ot-node-process.mjs';
class StepsUtils {

    forkNode(nodeConfiguration) {
        const forkedNode = fork(otNodeProcessPath, [], {silent: true});
        forkedNode.send(JSON.stringify(nodeConfiguration));
        return forkedNode;
    }


    createNodeConfiguration(blockchain, wallet, managementWallet, nodeIndex, nodeName, rpcPort, sharesTokenName, sharesTokenSymbol) {
        return {
            modules: {
                blockchain:
                    {
                        defaultImplementation: 'ganache',
                        implementation: {
                            ganache: {
                                config: {
                                    blockchainTitle: 'ganache',
                                    networkId: 'ganache::testnet',
                                    rpcEndpoints: ['http://localhost:7545'],
                                    hubContractAddress: blockchain.getHubAddress(),
                                    evmOperationalWalletPublicKey: wallet.address,
                                    evmOperationalWalletPrivateKey: wallet.privateKey,
                                    evmManagementWalletPublicKey: managementWallet.address,
                                    evmManagementPublicKey: managementWallet.address,
                                    sharesTokenName,
                                    sharesTokenSymbol
                                },
                            },
                        },
                    },
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
}
export default StepsUtils;
