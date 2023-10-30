import { fork } from 'child_process';

const otNodeProcessPath = './test/bdd/steps/lib/ot-node-process.mjs';
class StepsUtils {
    forkNode(nodeConfiguration) {
        const forkedNode = fork(otNodeProcessPath, [], { silent: true });
        forkedNode.send(JSON.stringify(nodeConfiguration));
        return forkedNode;
    }

    createNodeConfiguration(
        nodeWallets,
        nodeManagementWallets,
        nodeIndex,
        nodeName,
        rpcPort,
        networkPort,
        sharesTokenName,
        sharesTokenSymbol,
        bootstrap = false,
    ) {
        return {
            modules: {
                blockchain: {
                    implementation: {
                        hardhat: {
                            enabled: false,
                        },
                        'hardhat-test1': {
                            config: {
                                evmOperationalWalletPublicKey: nodeWallets[0].address,
                                evmOperationalWalletPrivateKey: nodeWallets[0].privateKey,
                                evmManagementWalletPublicKey: nodeManagementWallets[0].address,
                                evmManagementWalletPrivateKey: nodeManagementWallets[0].privateKey,
                                sharesTokenName,
                                sharesTokenSymbol,
                            },
                        },
                        'hardhat-test2': {
                            config: {
                                evmOperationalWalletPublicKey: nodeWallets[1].address,
                                evmOperationalWalletPrivateKey: nodeWallets[1].privateKey,
                                evmManagementWalletPublicKey: nodeManagementWallets[1].address,
                                evmManagementWalletPrivateKey: nodeManagementWallets[1].privateKey,
                                sharesTokenName,
                                sharesTokenSymbol,
                            },
                        },
                    },
                },
                network: {
                    implementation: {
                        'libp2p-service': {
                            config: {
                                port: networkPort,
                                privateKey: bootstrap
                                    ? 'CAAS4QQwggJdAgEAAoGBALOYSCZsmINMpFdH8ydA9CL46fB08F3ELfb9qiIq+z4RhsFwi7lByysRnYT/NLm8jZ4RvlsSqOn2ZORJwBywYD5MCvU1TbEWGKxl5LriW85ZGepUwiTZJgZdDmoLIawkpSdmUOc1Fbnflhmj/XzAxlnl30yaa/YvKgnWtZI1/IwfAgMBAAECgYEAiZq2PWqbeI6ypIVmUr87z8f0Rt7yhIWZylMVllRkaGw5WeGHzQwSRQ+cJ5j6pw1HXMOvnEwxzAGT0C6J2fFx60C6R90TPos9W0zSU+XXLHA7AtazjlSnp6vHD+RxcoUhm1RUPeKU6OuUNcQVJu1ZOx6cAcP/I8cqL38JUOOS7XECQQDex9WUKtDnpHEHU/fl7SvCt0y2FbGgGdhq6k8nrWtBladP5SoRUFuQhCY8a20fszyiAIfxQrtpQw1iFPBpzoq1AkEAzl/s3XPGi5vFSNGLsLqbVKbvoW9RUaGN8o4rU9oZmPFL31Jo9FLA744YRer6dYE7jJMel7h9VVWsqa9oLGS8AwJALYwfv45Nbb6yGTRyr4Cg/MtrFKM00K3YEGvdSRhsoFkPfwc0ZZvPTKmoA5xXEC8eC2UeZhYlqOy7lL0BNjCzLQJBAMpvcgtwa8u6SvU5B0ueYIvTDLBQX3YxgOny5zFjeUR7PS+cyPMQ0cyql8jNzEzDLcSg85tkDx1L4wi31Pnm/j0CQFH/6MYn3r9benPm2bYSe9aoJp7y6ht2DmXmoveNbjlEbb8f7jAvYoTklJxmJCcrdbNx/iCj2BuAinPPgEmUzfQ='
                                    : undefined,
                            },
                        },
                    },
                },
                repository: {
                    implementation: {
                        'sequelize-repository': {
                            config: {
                                database: bootstrap
                                    ? 'operationaldbbootstrap'
                                    : `operationaldbnode${nodeIndex}`,
                            },
                        },
                    },
                },
                tripleStore: {
                    implementation: {
                        'ot-blazegraph': {
                            config: {
                                repositories: {
                                    privateCurrent: {
                                        url: 'http://localhost:9999',
                                        name: 'private-current',
                                        username: 'admin',
                                        password: '',
                                    },
                                    privateHistory: {
                                        url: 'http://localhost:9999',
                                        name: 'private-history',
                                        username: 'admin',
                                        password: '',
                                    },
                                    publicCurrent: {
                                        url: 'http://localhost:9999',
                                        name: 'public-current',
                                        username: 'admin',
                                        password: '',
                                    },
                                    publicHistory: {
                                        url: 'http://localhost:9999',
                                        name: 'public-history',
                                        username: 'admin',
                                        password: '',
                                    },
                                },
                            },
                        },
                    },
                },
                validation: {
                    enabled: true,
                    implementation: {
                        'merkle-validation': {
                            enabled: true,
                            package: './validation/implementation/merkle-validation.js',
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
            auth: {
                ipBasedAuthEnabled: false,
            },
            operationalDatabase: {
                databaseName: bootstrap
                    ? 'operationaldbbootstrap'
                    : `operationaldbnode${nodeIndex}`,
            },
            rpcPort,
            appDataPath: bootstrap ? 'test-data-bootstrap' : `test-data${nodeIndex}`,
            graphDatabase: {
                name: nodeName,
            },
        };
    }
}
export default StepsUtils;
