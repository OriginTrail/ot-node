const { Given } = require('@cucumber/cucumber');
const { expect } = require('chai');
const { fork } = require('child_process');
const fs = require('fs');
const DkgClientHelper = require('../../utilities/dkg-client-helper');

const otNodeProcessPath = './test/bdd/steps/lib/ot-node-process.js';

function getBlockchainConfiguration(localBlockchain, privateKey, publicKey) {
    return [{
        blockchainTitle: 'ganache',
        networkId: 'ganache::testnet',
        rpcEndpoints: [
            'http://localhost:7545',
        ],
        hubContractAddress: localBlockchain.uaiRegistryContractAddress(),
        publicKey,
        privateKey,
    }];
}

Given(/^I setup (\d+) node[s]*$/, { timeout: 120000 }, function (nodeCount, done) {
    this.logger.log(`I setup ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`);
    const wallets = this.state.localBlockchain.getWallets();
    let nodesStarted = 0;
    for (let i = 0; i < nodeCount; i += 1) {
        const wallet = wallets[i + 1];
        const rpcPort = 8901 + i;
        const nodeName = `origintrail-test-${i}`;
        const nodeConfiguration = {
            graphDatabase: {
                name: nodeName,
            },
            blockchain: getBlockchainConfiguration(
                this.state.localBlockchain,
                wallet.privateKey,
                wallet.address,
            ),
            operationalDb: {
                databaseName: `operationaldbnode${i}`,
            },
            rpcPort,
            network: {
                id: 'Devnet',
                port: 9001 + i,
                bootstrap: [
                    '/ip4/0.0.0.0/tcp/9000/p2p/QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj',
                ],
            },
        };

        const forkedNode = fork(otNodeProcessPath, [], { silent: true });

        const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
        forkedNode.stdout.setEncoding('utf8');
        forkedNode.stdout.on('data', (data) => {
            // Here is where the output goes
            logFileStream.write(data);
        });
        forkedNode.send(JSON.stringify(nodeConfiguration));

        forkedNode.on('message', (response) => {
            if (response.error) {
                // todo handle error
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'localhost',
                    port: rpcPort,
                    useSSL: false,
                    timeout: 25,
                });
                this.state.nodes[i] = {
                    client,
                    forkedNode,
                };
            }
            nodesStarted += 1;
            if (nodesStarted === nodeCount) {
                done();
            }
        });
    }
});

Given(/^(\d+) bootstrap is running$/, { timeout: 80000 }, function (nodeCount, done) {
    expect(this.state.bootstraps).to.have.length(0);
    expect(nodeCount).to.be.equal(1); // Currently not supported more.
    console.log('Initializing bootstrap node');
    const wallets = this.state.localBlockchain.getWallets();
    const nodeName = 'origintrail-test-bootstrap';
    const bootstrapNodeConfiguration = {
        graphDatabase: {
            name: nodeName,
        },
        blockchain: getBlockchainConfiguration(
            this.state.localBlockchain,
            wallets[0].privateKey,
            wallets[0].address,
        ),
        operationalDb: {
            databaseName: 'operationaldbbootstrap',
        },
        rpcPort: 8900,
        network: {
            id: 'Devnet',
            port: 9000,
            privateKey: 'CAAS4QQwggJdAgEAAoGBALOYSCZsmINMpFdH8ydA9CL46fB08F3ELfb9qiIq+z4RhsFwi7lByysRnYT/NLm8jZ4RvlsSqOn2ZORJwBywYD5MCvU1TbEWGKxl5LriW85ZGepUwiTZJgZdDmoLIawkpSdmUOc1Fbnflhmj/XzAxlnl30yaa/YvKgnWtZI1/IwfAgMBAAECgYEAiZq2PWqbeI6ypIVmUr87z8f0Rt7yhIWZylMVllRkaGw5WeGHzQwSRQ+cJ5j6pw1HXMOvnEwxzAGT0C6J2fFx60C6R90TPos9W0zSU+XXLHA7AtazjlSnp6vHD+RxcoUhm1RUPeKU6OuUNcQVJu1ZOx6cAcP/I8cqL38JUOOS7XECQQDex9WUKtDnpHEHU/fl7SvCt0y2FbGgGdhq6k8nrWtBladP5SoRUFuQhCY8a20fszyiAIfxQrtpQw1iFPBpzoq1AkEAzl/s3XPGi5vFSNGLsLqbVKbvoW9RUaGN8o4rU9oZmPFL31Jo9FLA744YRer6dYE7jJMel7h9VVWsqa9oLGS8AwJALYwfv45Nbb6yGTRyr4Cg/MtrFKM00K3YEGvdSRhsoFkPfwc0ZZvPTKmoA5xXEC8eC2UeZhYlqOy7lL0BNjCzLQJBAMpvcgtwa8u6SvU5B0ueYIvTDLBQX3YxgOny5zFjeUR7PS+cyPMQ0cyql8jNzEzDLcSg85tkDx1L4wi31Pnm/j0CQFH/6MYn3r9benPm2bYSe9aoJp7y6ht2DmXmoveNbjlEbb8f7jAvYoTklJxmJCcrdbNx/iCj2BuAinPPgEmUzfQ=',
        },
    };
    const forkedNode = fork(otNodeProcessPath, [], { silent: true });

    const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
    forkedNode.stdout.setEncoding('utf8');
    forkedNode.stdout.on('data', (data) => {
        // Here is where the output goes
        logFileStream.write(data);
    });
    forkedNode.send(JSON.stringify(bootstrapNodeConfiguration));

    forkedNode.on('message', async (response) => {
        if (response.error) {
            // todo handle error
        } else {
            // todo if started
            const client = new DkgClientHelper({
                endpoint: 'localhost',
                port: 8900,
                useSSL: false,
                timeout: 25,
            });
            this.state.bootstraps.push({
                client,
                forkedNode,
            });
        }
        done();
    });
});

Given(/^I setup (\d+) additional node[s]*$/, { timeout: 120000 }, function (nodeCount, done) {
    this.logger.log(`I setup ${nodeCount} additional node${nodeCount !== 1 ? 's' : ''}`);
    const wallets = this.state.localBlockchain.getWallets();
    const currentNumberOfNodes = Object.keys(this.state.nodes).length;
    let nodesStarted = 0;
    for (let i = 0; i < nodeCount; i += 1) {
        const nodeIndex = currentNumberOfNodes + i;
        const wallet = wallets[nodeIndex];
        const rpcPort = 8901 + nodeIndex;
        const nodeName = `origintrail-test-${nodeIndex}`;
        const nodeConfiguration = {
            graphDatabase: {
                name: nodeName,
            },
            blockchain: getBlockchainConfiguration(
                this.state.localBlockchain,
                wallet.privateKey,
                wallet.address,
            ),
            operationalDb: {
                databaseName: `operationaldbnode${nodeIndex}`,
            },
            rpcPort,
            network: {
                id: 'Devnet',
                port: 9001 + nodeIndex,
                bootstrap: [
                    '/ip4/0.0.0.0/tcp/9000/p2p/QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj',
                ],
            },
        };

        const forkedNode = fork(otNodeProcessPath, [], { silent: true });

        const logFileStream = fs.createWriteStream(`${this.state.scenarionLogDir}/${nodeName}.log`);
        forkedNode.stdout.setEncoding('utf8');
        forkedNode.stdout.on('data', (data) => {
            // Here is where the output goes
            logFileStream.write(data);
        });
        forkedNode.send(JSON.stringify(nodeConfiguration));

        forkedNode.on('message', (response) => {
            if (response.error) {
                // todo handle error
            } else {
                // todo if started
                const client = new DkgClientHelper({
                    endpoint: 'localhost',
                    port: rpcPort,
                    useSSL: false,
                    timeout: 25,
                });
                this.state.nodes[nodeIndex] = {
                    client,
                    forkedNode,
                };
            }
            nodesStarted += 1;
            if (nodesStarted === nodeCount) {
                done();
            }
        });
    }
});
