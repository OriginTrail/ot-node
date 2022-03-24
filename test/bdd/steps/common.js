const { Given } = require('@cucumber/cucumber');
const assert = require('assert');
const { expect } = require('chai');
const OTNode = require('../../../ot-node');
const HttpApiHelper = require('../../utilities/http-api-helper');

function getBlockchainConfiguration(localBlockchain) {
    return [{
        blockchainTitle: 'ganache',
        networkId: 'ganache::testnet',
        rpcEndpoints: [
            'http://localhost:7545',
        ],
        hubContractAddress: localBlockchain.dkgContractAddress(),
        publicKey: '',
        privateKey: '',
    }];
}

Given(/^I setup (\d+) node[s]*$/, { timeout: 120000 }, function (nodeCount, done) {
    this.logger.log(`I setup ${nodeCount} node${nodeCount !== 1 ? 's' : ''}`);

    const promises = [];
    for (let i = 0; i < nodeCount; i += 1) {
        const nodeConfiguration = {
            graphDatabase: {
                name: `origintrail-test-${i}`,
            },
            blockchain: getBlockchainConfiguration(this.state.localBlockchain),
            rpcPort: 8901 + i,
            network: {
                id: 'Devnet',
                port: 9001 + i,
                bootstrap: [
                    '/ip4/0.0.0.0/tcp/9000/p2p/QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj',
                ],
            },
        };

        const newNode = new OTNode(nodeConfiguration);
        this.state.nodes.push(newNode);
        promises.push(newNode.start());
    }
    Promise.all(promises).then(() => {
        done();
    });
});

Given(/^(\d+) bootstrap is running$/, { timeout: 80000 }, function (nodeCount, done) {
    expect(this.state.bootstraps).to.have.length(0);
    expect(nodeCount).to.be.equal(1); // Currently not supported more.

    const bootstrapNode = new OTNode(
        {
            graphDatabase: {
                name: 'origintrail-test-bootstrap',
            },
            blockchain: getBlockchainConfiguration(this.state.localBlockchain),
            rpcPort: 8900,
            network: {
                id: 'Devnet',
                port: 9000,
                privateKey: 'CAAS4QQwggJdAgEAAoGBALOYSCZsmINMpFdH8ydA9CL46fB08F3ELfb9qiIq+z4RhsFwi7lByysRnYT/NLm8jZ4RvlsSqOn2ZORJwBywYD5MCvU1TbEWGKxl5LriW85ZGepUwiTZJgZdDmoLIawkpSdmUOc1Fbnflhmj/XzAxlnl30yaa/YvKgnWtZI1/IwfAgMBAAECgYEAiZq2PWqbeI6ypIVmUr87z8f0Rt7yhIWZylMVllRkaGw5WeGHzQwSRQ+cJ5j6pw1HXMOvnEwxzAGT0C6J2fFx60C6R90TPos9W0zSU+XXLHA7AtazjlSnp6vHD+RxcoUhm1RUPeKU6OuUNcQVJu1ZOx6cAcP/I8cqL38JUOOS7XECQQDex9WUKtDnpHEHU/fl7SvCt0y2FbGgGdhq6k8nrWtBladP5SoRUFuQhCY8a20fszyiAIfxQrtpQw1iFPBpzoq1AkEAzl/s3XPGi5vFSNGLsLqbVKbvoW9RUaGN8o4rU9oZmPFL31Jo9FLA744YRer6dYE7jJMel7h9VVWsqa9oLGS8AwJALYwfv45Nbb6yGTRyr4Cg/MtrFKM00K3YEGvdSRhsoFkPfwc0ZZvPTKmoA5xXEC8eC2UeZhYlqOy7lL0BNjCzLQJBAMpvcgtwa8u6SvU5B0ueYIvTDLBQX3YxgOny5zFjeUR7PS+cyPMQ0cyql8jNzEzDLcSg85tkDx1L4wi31Pnm/j0CQFH/6MYn3r9benPm2bYSe9aoJp7y6ht2DmXmoveNbjlEbb8f7jAvYoTklJxmJCcrdbNx/iCj2BuAinPPgEmUzfQ=',
            },
        },
    );

    this.state.bootstraps.push(bootstrapNode);

    bootstrapNode.start().then(() => done());
});
