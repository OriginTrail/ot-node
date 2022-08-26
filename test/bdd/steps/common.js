const { Given } = require('@cucumber/cucumber');
const DeepExtend = require('deep-extend');
const { expect, assert } = require('chai');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const DkgClientHelper = require('../../utilities/dkg-client-helper');

const PATH_TO_CONFIGS = './config/';
const otNodeProcessPath = './test/bdd/steps/lib/ot-node-process.js';
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
                        hubContractAddress: localBlockchain.uaiRegistryContractAddress(),
                        evmOperationalWalletPublicKey: publicKey,
                        evmOperationalWalletPrivateKey: privateKey,
                        evmManagementWalletPublicKey: managementKey,
                    },
                },
            },
        },
    ];
}

function forkNode(nodeConfiguration) {
    const forkedNode = fork(otNodeProcessPath, [], { silent: true });
    forkedNode.send(JSON.stringify(nodeConfiguration));
    return forkedNode;
}

function createNodeConfiguration(wallet, managementWallet, nodeIndex, nodeName, rpcPort) {
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

Given(/^I setup (\d+) node[s]*$/, { timeout: 80000 }, function nodeSetup(nodeCount, done) {
    this.logger.log(`I setup ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`);
    const wallets = this.state.localBlockchain.getWallets();
    const currentNumberOfNodes = Object.keys(this.state.nodes).length;
    let nodesStarted = 0;
    for (let i = 0; i < nodeCount; i += 1) {
        const nodeIndex = currentNumberOfNodes + i;
        const wallet = wallets[nodeIndex + 1];
        const managementWallet = wallets[nodeIndex + 28];
        const rpcPort = 8901 + nodeIndex;
        const nodeName = `origintrail-test-${nodeIndex}`;

        const defaultConfiguration = JSON.parse(
            fs
                .readFileSync(
                    path.join(__dirname, `${PATH_TO_CONFIGS}origintrail-test-node-config.json`),
                )
                .toString(),
        );

        // eslint-disable-next-line prefer-destructuring
        const nodeConfiguration = DeepExtend(
            defaultConfiguration,
            createNodeConfiguration.call(
                this,
                wallet,
                managementWallet,
                nodeIndex,
                nodeName,
                rpcPort,
            ),
        );
        const forkedNode = forkNode(nodeConfiguration);

        const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
        forkedNode.stdout.setEncoding('utf8');
        forkedNode.stdout.on('data', (data) => {
            // Here is where the output goes
            logFileStream.write(data);
        });
        // eslint-disable-next-line no-loop-func
        forkedNode.on('message', (response) => {
            if (response.error) {
                assert.fail(
                    `Error while trying initialize node${nodeIndex} client: ${response.error}`,
                );
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'http://localhost',
                    port: rpcPort,
                    useSSL: false,
                    timeout: 25,
                    loglevel: 'trace',
                });
                this.state.nodes[nodeIndex] = {
                    client,
                    forkedNode,
                    configuration: nodeConfiguration,
                    nodeRpcUrl: `http://localhost:${rpcPort}`,
                };
            }
            nodesStarted += 1;
            if (nodesStarted === nodeCount) {
                done();
            }
        });
    }
});

Given(
    /^(\d+) bootstrap is running$/,
    { timeout: 60000 },
    function bootstrapRunning(nodeCount, done) {
        expect(this.state.bootstraps).to.have.length(0);
        expect(nodeCount).to.be.equal(1); // Currently not supported more.
        this.logger.log('Initializing bootstrap node');
        const nodeName = 'origintrail-test-bootstrap';
        const bootstrapNodeConfiguration = JSON.parse(
            fs
                .readFileSync(path.join(__dirname, `${PATH_TO_CONFIGS}${nodeName}-config.json`))
                .toString(),
        );
        const forkedNode = forkNode(bootstrapNodeConfiguration);

        const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
        forkedNode.stdout.setEncoding('utf8');
        forkedNode.stdout.on('data', (data) => {
            // Here is where the output goes
            logFileStream.write(data);
        });

        forkedNode.on('message', async (response) => {
            if (response.error) {
                // todo handle error
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'http://localhost',
                    port: 8900,
                    useSSL: false,
                    timeout: 25,
                    loglevel: 'trace',
                });
                this.state.bootstraps.push({
                    client,
                    forkedNode,
                    configuration: bootstrapNodeConfiguration,
                    nodeRpcUrl: `http://localhost:${bootstrapNodeConfiguration.rpcPort}`,
                });
            }
            done();
        });
    },
);

Given(
    /^I setup (\d+) additional node[s]*$/,
    { timeout: 120000 },
    function setupAdditionalNode(nodeCount, done) {
        this.logger.log(`I setup ${nodeCount} additional node${nodeCount !== 1 ? 's' : ''}`);
        const wallets = this.state.localBlockchain.getWallets();
        const currentNumberOfNodes = Object.keys(this.state.nodes).length;
        let nodesStarted = 0;
        for (let i = 0; i < nodeCount; i += 1) {
            const nodeIndex = currentNumberOfNodes + i;
            const wallet = wallets[nodeIndex];
            const managementWallet = wallets[nodeIndex + 28];
            const rpcPort = 8901 + nodeIndex;
            const nodeName = `origintrail-test-${nodeIndex}`;
            const defaultConfiguration = JSON.parse(
                fs
                    .readFileSync(
                        path.join(__dirname, `${PATH_TO_CONFIGS}origintrail-test-node-config.json`),
                    )
                    .toString(),
            );
            const nodeConfiguration = DeepExtend(
                defaultConfiguration,
                createNodeConfiguration.call(
                    this,
                    wallet,
                    managementWallet,
                    nodeIndex,
                    nodeName,
                    rpcPort,
                ),
            );
            const forkedNode = forkNode(nodeConfiguration);

            const logFileStream = fs.createWriteStream(
                `${this.state.scenarionLogDir}/${nodeName}.log`,
            );
            forkedNode.stdout.setEncoding('utf8');
            forkedNode.stdout.on('data', (data) => {
                // Here is where the output goes
                logFileStream.write(data);
            });

            // eslint-disable-next-line no-loop-func
            forkedNode.on('message', (response) => {
                if (response.error) {
                    assert.fail(
                        `Error while trying initialize node${nodeIndex} client: ${response.error}`,
                    );
                } else {
                    // todo if started
                    const client = new DkgClientHelper({
                        endpoint: 'http://localhost',
                        port: rpcPort,
                        useSSL: false,
                        timeout: 25,
                        loglevel: 'trace',
                    });
                    this.state.nodes[nodeIndex] = {
                        client,
                        forkedNode,
                        configuration: nodeConfiguration,
                        nodeRpcUrl: `http://localhost:${rpcPort}`,
                    };
                }
                nodesStarted += 1;
                if (nodesStarted === nodeCount) {
                    done();
                }
            });
        }
    },
);
Given(
    /^I setup publish node (\d+) with invalid configuration/,
    { timeout: 120000 },
    function setupPublishNode(nodeIndex, done) {
        this.logger.log(`I setup node ${nodeIndex} with invalid configuration`);
        const wallet = this.state.localBlockchain.getWallets()[nodeIndex];
        const managementWallet = this.state.localBlockchain.getWallets()[nodeIndex + 28];
        const rpcPort = 8901 + nodeIndex;
        const nodeName = `origintrail-test-${nodeIndex}`;
        const defaultConfiguration = JSON.parse(
            fs
                .readFileSync(
                    path.join(__dirname, `${PATH_TO_CONFIGS}origintrail-test-node-config.json`),
                )
                .toString(),
        );
        // eslint-disable-next-line prefer-destructuring
        const nodeConfiguration = DeepExtend(
            defaultConfiguration,
            createNodeConfiguration.call(
                this,
                wallet,
                managementWallet,
                nodeIndex,
                nodeName,
                rpcPort,
            ),
        );
        nodeConfiguration.minimumAckResponses.publish = 10;
        const forkedNode = forkNode(nodeConfiguration);

        const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
        forkedNode.stdout.setEncoding('utf8');
        forkedNode.stdout.on('data', (data) => {
            // Here is where the output goes
            logFileStream.write(data);
        });

        // eslint-disable-next-line no-loop-func
        forkedNode.on('message', (response) => {
            if (response.error) {
                assert.fail(
                    `Error while trying initialize node${nodeIndex} client: ${response.error}`,
                );
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'http://localhost',
                    port: rpcPort,
                    useSSL: false,
                    timeout: 25,
                    loglevel: 'trace',
                });
                this.state.nodes[nodeIndex] = {
                    client,
                    forkedNode,
                    configuration: nodeConfiguration,
                    nodeRpcUrl: `http://localhost:${rpcPort}`,
                };
            }
            done();
        });
    },
);
