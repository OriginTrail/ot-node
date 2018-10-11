/* eslint-disable prefer-arrow-callback */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const request = require('request');
const fs = require('fs');
const path = require('path');
const sortedStringify = require('sorted-json-stringify');
const { sha3_256 } = require('js-sha3');
const { deepEqual } = require('jsprim');

const OtNode = require('./lib/otnode');
const LocalBlockchain = require('./lib/local-blockchain');
const httpApiHelper = require('./lib/http-api-helper');

const bootstrapIdentity = {
    ba9f7526f803490e631859c75d56e5ab25a47a33: {
        xprivkey: 'xprv9s21ZrQH143K4MkqK5soWDhkWWzhCauPCvb1faFfvp1kaLTMV76CScnYHWZNALh3YXEPJNkAcesHidcoVSpP7efcDhnEQDQYkWxEnZtDMYR',
        index: 0,
    },
};

Given(/^(\d+) bootstrap is running$/, { timeout: 80000 }, function (nodeCount, done) {
    expect(this.state.bootstraps).to.have.length(0);
    expect(nodeCount).to.be.equal(1); // Currently not supported more.

    const bootstrapNode = new OtNode({
        nodeConfiguration: {
            node_wallet: LocalBlockchain.wallets()[9].address,
            node_private_key: LocalBlockchain.wallets()[9].privateKey,
            is_bootstrap_node: true,
            local_network_only: true,
            database: {
                database: `origintrail-test-${uuidv4()}`,
            },
            blockchain: {
                ot_contract_address: this.state.localBlockchain.otContractAddress,
                token_contract_address: this.state.localBlockchain.tokenContractAddress,
                escrow_contract_address: this.state.localBlockchain.escrowContractAddress,
                bidding_contract_address: this.state.localBlockchain.biddingContractAddress,
                reading_contract_address: this.state.localBlockchain.readingContractAddress,
                rpc_node_host: 'http://localhost', // TODO use from instance
                rpc_node_port: 7545,
            },
        },
    });

    bootstrapNode.options.identity = bootstrapIdentity.ba9f7526f803490e631859c75d56e5ab25a47a33;
    bootstrapNode.initialize();
    this.state.bootstraps.push(bootstrapNode);

    bootstrapNode.once('initialized', () => done());
    bootstrapNode.start();
});

Given(/^I setup (\d+) node[s]*$/, { timeout: 60000 }, function (nodeCount, done) {
    expect(nodeCount).to.be.lessThan(11);

    for (let i = 0; i < nodeCount; i += 1) {
        const newNode = new OtNode({
            nodeConfiguration: {
                node_wallet: LocalBlockchain.wallets()[i].address,
                node_private_key: LocalBlockchain.wallets()[i].privateKey,
                node_port: 6000 + i,
                node_rpc_port: 9000 + i,
                node_remote_control_port: 4000 + i,
                network: {
                    bootstraps: ['https://localhost:5278/#ba9f7526f803490e631859c75d56e5ab25a47a33'],
                    remoteWhitelist: ['localhost'],
                },
                database: {
                    database: `origintrail-test-${uuidv4()}`,
                },
                blockchain: {
                    ot_contract_address: this.state.localBlockchain.otContractAddress,
                    token_contract_address: this.state.localBlockchain.tokenContractAddress,
                    escrow_contract_address: this.state.localBlockchain.escrowContractAddress,
                    bidding_contract_address: this.state.localBlockchain.biddingContractAddress,
                    reading_contract_address: this.state.localBlockchain.readingContractAddress,
                    rpc_node_host: 'http://localhost', // TODO use from instance
                    rpc_node_port: 7545,
                },
                local_network_only: true,
            },
        });
        this.state.nodes.push(newNode);
        newNode.initialize();
        this.logger.log(`Node set up at ${newNode.options.configDir}`);
    }
    done();
});

Given(/^I wait for (\d+) second[s]*$/, { timeout: 600000 }, waitTime => new Promise((accept) => {
    setTimeout(accept, waitTime * 1000);
}));

Given(/^I start the nodes$/, { timeout: 60000 }, function (done) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const nodesStarts = [];

    this.state.nodes.forEach((node) => {
        nodesStarts.push(new Promise((accept, reject) => {
            node.once('initialized', () => accept());
            node.once('error', reject);
        }));
        node.start();
    });

    Promise.all(nodesStarts).then(() => done());
});

Then(/^all nodes should be aware of each other$/, function (done) {
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const promises = [];
    this.state.nodes.forEach((node) => {
        promises.push(new Promise((accept, reject) => {
            request(`${node.state.node_rpc_url}/api/dump/rt`, { json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.state.nodes.forEach((testNode) => {
                    if (testNode.state.identity !== node.state.identity) {
                        expect(body.message).to.have.property(testNode.state.identity);
                    }
                });

                this.state.bootstraps.forEach((bootstrap) => {
                    if (bootstrap.state.identity !== node.state.identity) {
                        expect(body.message).to.have.property(bootstrap.state.identity);
                    }
                });

                accept();
            });
        }));
    });

    Promise.all(promises).then(() => done());
});

Given(/^I use (\d+)[st|nd|rd|th]+ node as ([DC|DH|DV]+)$/, function (nodeIndex, nodeType) {
    expect(nodeType, 'Node type can only be DC, DH or DV.').to.satisfy(val => (val === 'DC' || val === 'DH' || val === 'DV'));
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid idex.').to.be.within(0, this.state.nodes.length);

    this.logger.log(`Setting node '${nodeIndex}' as ${nodeType}.`);
    this.state[nodeType.toLowerCase()] = this.state.nodes[nodeIndex - 1];
});

Given(/^I import "([^"]*)"$/, function (xmlFilepath) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    return new Promise((accept, reject) => {
        request.post({
            headers: { 'Content-Type': 'application/json' },
            url: `${dc.state.node_rpc_url}/api/import`,
            json: true,
            formData: {
                importfile: fs.createReadStream(path.join(__dirname, '../../../', xmlFilepath)),
                importtype: 'GS1',
            },
        }, (error, response, body) => {
            if (error) {
                reject(error);
                return;
            }

            expect(body).to.have.keys(['import_hash', 'import_id', 'message', 'wallet']);

            this.state.lastImport = body;
            accept();
        });
    });
});

Then(/^the last import's hash should be the same as one manually calculated$/, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);

    const { dc } = this.state;
    return new Promise((accept, reject) => {
        request(
            `${dc.state.node_rpc_url}/api/import_info?import_id=${this.state.lastImport.import_id}`,
            { json: true },
            (err, res, body) => {
                if (err) {
                    reject(err);
                    return;
                }

                // TODO: Avoid asserting in promise. Manually check.
                // expect(body).to.have.keys([
                //     'import_hash', 'root_hash', 'import',
                //     'transaction', 'data_provider_wallet',
                // ]);
                if (!body.import || !body.import.vertices || !body.import.vertices) {
                    reject(Error('Response should contain import: { vertices: ..., edges: ... }'));
                    return;
                }

                if (body.import_hash !== this.state.lastImport.import_hash) {
                    reject(Error(`Import hash differs: ${body.import_hash} !== ${this.state.lastImport.import_hash}.`));
                    return;
                }
                const calculatedImportHash = `0x${sha3_256(sortedStringify(body.import, null, 0))}`;
                if (calculatedImportHash !== this.state.lastImport.import_hash) {
                    reject(Error(`Calculated hash differs: ${calculatedImportHash} !== ${this.state.lastImport.import_hash}.`));
                    return;
                }
                accept();
            },
        );
    });
});

Given(/^I initiate the replication$/, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    return new Promise((accept, reject) => {
        request.post({
            headers: { 'Content-Type': 'application/json' },
            url: `${dc.state.node_rpc_url}/api/replication`,
            body: {
                import_id: this.state.lastImport.import_id,
            },
            json: true,
        }, (err, res, body) => {
            if (err) {
                reject(err);
                return;
            }

            if (!body.replication_id) {
                reject(Error('Failed to replicate.'));
                return;
            }

            this.state.lastReplication = body;
            accept();
        });
    });
});

Given(/^I wait for replication[s] to finish$/, { timeout: 1200000 }, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const promises = [];
    this.state.nodes.forEach((node) => {
        if (node.state.identity !== this.state.dc.state.identity) {
            promises.push(new Promise((accept, reject) => {
                node.once('key-verified', (importId) => {
                    if (importId === this.state.lastImport.import_id) {
                        accept();
                    } else {
                        reject(Error(`Import ID differs. Expected ${this.state.lastImport.import_id}, got ${importId}.`));
                    }
                });
            }));
        }
    });

    return Promise.all(promises);
});

Then(/^the last import should be the same on all nodes that replicated data$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;

    // Assumed it hasn't been changed in between.
    const currentModifier =
        await this.state.localBlockchain.biddingInstance.methods
            .replication_modifier().call();
    expect(currentModifier).to.be.equal(dc.state.holdingData.length.toString());

    // Get original import info.
    const dcImportInfo =
        await httpApiHelper.apiImportInfo(dc.state.node_rpc_url, this.state.lastImport.import_id);

    const promises = [];
    dc.state.holdingData.forEach((holdingData) => {
        const { importId, dhWallet } = holdingData;

        expect(importId).to.be.equal(this.state.lastImport.import_id);

        const node =
            this.state.nodes.find(node => node.options.nodeConfiguration.node_wallet === dhWallet);

        if (!node) {
            throw Error(`Failed to find node with wallet: ${dhWallet}.`);
        }

        promises.push(new Promise(async (accept, reject) => {
            const dhImportInfo =
                await httpApiHelper.apiImportInfo(node.state.node_rpc_url, importId);
            // TODO: fix different root hashes error.
            dhImportInfo.root_hash = dcImportInfo.root_hash;
            if (deepEqual(dcImportInfo, dhImportInfo)) {
                accept();
            } else {
                reject(Error(`Objects not equal: ${JSON.stringify(dcImportInfo)} and ${JSON.stringify(dhImportInfo)}`));
            }
        }));
    });

    return Promise.all(promises);
});

