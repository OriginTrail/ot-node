/* eslint-disable prefer-arrow-callback, max-len */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const request = require('request');
const sortedStringify = require('sorted-json-stringify');
const { sha3_256 } = require('js-sha3');
const { deepEqual } = require('jsprim');

const OtNode = require('./lib/otnode');
const Utilities = require('../../../modules/Utilities');
const LocalBlockchain = require('./lib/local-blockchain');
const httpApiHelper = require('./lib/http-api-helper');
const ImportUtilities = require('../../../modules/ImportUtilities');

const bootstrapIdentity = {
    ba9f7526f803490e631859c75d56e5ab25a47a33: {
        xprivkey: 'xprv9s21ZrQH143K4MkqK5soWDhkWWzhCauPCvb1faFfvp1kaLTMV76CScnYHWZNALh3YXEPJNkAcesHidcoVSpP7efcDhnEQDQYkWxEnZtDMYR',
        index: 0,
    },
};

Given(/^(\d+) bootstrap is running$/, { timeout: 80000 }, function (nodeCount, done) {
    expect(this.state.bootstraps).to.have.length(0);
    expect(nodeCount).to.be.equal(1); // Currently not supported more.

    const walletCount = LocalBlockchain.wallets().length;

    const bootstrapNode = new OtNode({
        nodeConfiguration: {
            node_wallet: LocalBlockchain.wallets()[walletCount - 1].address,
            node_private_key: LocalBlockchain.wallets()[walletCount - 1].privateKey,
            is_bootstrap_node: true,
            local_network_only: true,
            database: {
                password: '',
                database: `origintrail-test-${uuidv4()}`,
            },
            blockchain: {
                hub_contract_address: this.state.localBlockchain.hubContractAddress,
                rpc_node_host: 'http://localhost', // TODO use from instance
                rpc_node_port: 7545,
            },
            network: {
                bootstraps: ['https://localhost:5278/#ba9f7526f803490e631859c75d56e5ab25a47a33'],
                remoteWhitelist: ['localhost'],
            },
        },
    });

    bootstrapNode.options.identity = bootstrapIdentity.ba9f7526f803490e631859c75d56e5ab25a47a33;
    bootstrapNode.initialize();
    this.state.bootstraps.push(bootstrapNode);

    bootstrapNode.once('initialized', () => done());
    bootstrapNode.start();
});

Given(/^I setup (\d+) node[s]*$/, { timeout: 120000 }, function (nodeCount, done) {
    expect(nodeCount).to.be.lessThan(LocalBlockchain.wallets().length - 1);

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
                    hub_contract_address: this.state.localBlockchain.hubContractAddress,
                    rpc_node_host: 'http://localhost', // TODO use from instance
                    rpc_node_port: 7545,
                },
                local_network_only: true,
                dc_choose_time: 60000, // 1 minute
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

Given(/^I start the nodes$/, { timeout: 3000000 }, function (done) {
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

Given(/^I import "([^"]*)" as ([GS1|WOT]+)$/, async function (importFilePath, importType) {
    expect(importType, 'importType can only be GS1 or WOT.').to.satisfy(val => (val === 'GS1' || val === 'WOT'));
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;


    const importResponse = await httpApiHelper.apiImport(host, importFilePath, importType);

    expect(importResponse).to.have.keys(['data_set_id', 'message', 'wallet']);
    this.state.lastImport = importResponse;
});

Then(/^the last import's hash should be the same as one manually calculated$/, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);

    const { dc } = this.state;
    return new Promise((accept, reject) => {
        request(
            `${dc.state.node_rpc_url}/api/import_info?data_set_id=${this.state.lastImport.data_set_id}`,
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
                if (!body.import || !body.import.vertices || !body.import.edges) {
                    reject(Error(`Response should contain import: { vertices: ..., edges: ... }\n${JSON.stringify(body)}`));
                    return;
                }

                const calculatedImportHash = `0x${sha3_256(sortedStringify(body.import, null, 0))}`;
                if (calculatedImportHash !== this.state.lastImport.data_set_id) {
                    reject(Error(`Calculated hash differs: ${calculatedImportHash} !== ${this.state.lastImport.data_set_id}.`));
                    return;
                }

                // TODO: Calculate root hash here and test it against body.root_hash.
                accept();
            },
        );
    });
});

Given(/^I initiate the replication$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const response = await httpApiHelper.apiReplication(dc.state.node_rpc_url, this.state.lastImport.data_set_id);

    if (!response.replication_id) {
        throw Error(`Failed to replicate. Got reply: ${JSON.stringify(response)}`);
    }

    this.state.lastReplication = response;
});

Given(/^I wait for replication[s] to finish$/, { timeout: 1200000 }, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const promises = [];

    // All nodes including DC emit offer-finalized.
    this.state.nodes.forEach((node) => {
        promises.push(new Promise((acc) => {
            node.once('offer-finalized', (offerId) => {
                // TODO: Change API to connect internal offer ID and external offer ID.
                acc();
            });
        }));
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

    // Expect everyone to have data
    expect(dc.state.replications.length, 'Not every node replicated data.').to.equal(this.state.nodes.length - 1);

    // Get offer ID for last import.
    const lastOfferId = dc.state.offers.internalIDs[this.state.lastReplication.offer_id].offerId;

    // Assumed it hasn't been changed in between.
    const currentDifficulty =
        await this.state.localBlockchain.holdingInstance.methods.difficultyOverride().call();

    // TODO: Check how many actually was chosen.
    let chosenCount = 0;
    this.state.nodes.forEach(node => (
        chosenCount += (node.state.takenBids.includes(lastOfferId) ? 1 : 0)));

    if (currentDifficulty > 0) {
        expect(currentDifficulty).to.equal(chosenCount);
    } else {
        // From holding contract:
        let difficulty = 0;
        if (Math.log2(this.state.nodes.length) <= 4) {
            difficulty = 1;
        } else {
            difficulty = 4 + (((Math.log2(this.state.nodes.length) - 4) * 10000) / 13219);
        }

        // TODO: test the task's difficulty.
        expect(chosenCount).to.equal(3);
    }

    // Get original import info.
    const dcImportInfo =
        await httpApiHelper.apiImportInfo(dc.state.node_rpc_url, this.state.lastImport.data_set_id);

    const promises = [];
    dc.state.replications.forEach(({ internalOfferId, dhId }) => {
        if (dc.state.offers.internalIDs[internalOfferId].dataSetId === this.state.lastImport.data_set_id) {
            const node =
                this.state.nodes.find(node => node.state.identity === dhId);

            if (!node) {
                throw Error(`Failed to find node with ID: ${dhId}.`);
            }

            promises.push(new Promise(async (accept, reject) => {
                const dhImportInfo =
                    await httpApiHelper.apiImportInfo(node.state.node_rpc_url, this.state.lastImport.data_set_id);
                // TODO: fix different root hashes error.
                dhImportInfo.root_hash = dcImportInfo.root_hash;
                if (deepEqual(dcImportInfo, dhImportInfo)) {
                    accept();
                } else {
                    reject(Error(`Objects not equal: ${JSON.stringify(dcImportInfo)} and ${JSON.stringify(dhImportInfo)}`));
                }
            }));
        }
    });

    return Promise.all(promises);
});

Given(/^I remember previous import's fingerprint value$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodesWalletAddress !== 'null', 'Nodes wallet should be non null value').to.be.equal(true);

    const { dc } = this.state;

    const myFingerprint = await httpApiHelper.apiFingerprint(dc.state.node_rpc_url, this.state.lastImport.data_set_id);
    expect(myFingerprint).to.have.keys(['root_hash']);
    expect(Utilities.isZeroHash(myFingerprint.root_hash), 'root hash value should not be zero hash').to.be.equal(false);

    // TODO need better namings
    this.state.lastMinusOneImportFingerprint = myFingerprint;
    this.state.lastMinusOneImport = this.state.lastImport;
});

Then(/^checking again first import's root hash should point to remembered value$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodesWalletAddress !== 'null', 'Nodes wallet should be non null value').to.be.equal(true);

    const { dc } = this.state;

    const firstImportFingerprint = await httpApiHelper.apiFingerprint(dc.state.node_rpc_url, this.state.lastMinusOneImport.data_set_id);
    expect(firstImportFingerprint).to.have.keys(['root_hash']);
    expect(Utilities.isZeroHash(firstImportFingerprint.root_hash), 'root hash value should not be zero hash').to.be.equal(false);

    expect(firstImportFingerprint.root_hash).to.be.equal(this.state.lastMinusOneImportFingerprint.root_hash);
    expect(deepEqual(firstImportFingerprint, this.state.lastMinusOneImportFingerprint), 'import and root has in both scenario should be indentical').to.be.equal(true);
});

Given(/^I call api-query-local with query consisting of path: "(\S+)", value: "(\S+)" and opcode: "(\S+)" for last import$/, async function (path, value, opcode) {
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(opcode, 'Opcode should only be EQ or IN.').to.satisfy(val => (val === 'EQ' || val === 'IN'));

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;
    const jsonQuery = {
        query:
            [
                {
                    path,
                    value,
                    opcode,
                },
            ],
    };
    const response = await httpApiHelper.apiQueryLocal(host, jsonQuery);
    this.state.apiQueryLocalResponse = response;
});

Given(/^I call api-query-local-import with query consisting of path: "(\S+)", value: "(\S+)" and opcode: "(\S+)" for last import$/, async function (path, value, opcode) {
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(opcode, 'Opcode should only be EQ or IN.').to.satisfy(val => (val === 'EQ' || val === 'IN'));

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;
    const jsonQuery = {
        query:
            [
                {
                    path,
                    value,
                    opcode,
                },
            ],
    };
    const response = await httpApiHelper.apiQueryLocalImport(host, jsonQuery);
    this.state.apiQueryLocalImportResponse = response;
});

Given(/^I call api-query-local-import-importId endpoint for last import$/, async function () {
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;
    const lastImportId = this.state.lastImport.import_id;

    const response = await httpApiHelper.apiQueryLocalImportByImportId(host, lastImportId);
    this.state.apiQueryLocalImportByImportIdResponse = response;
});

Then(/^api-query-local response should have certain structure$/, function () {
    expect(!!this.state.apiQueryLocalResponse, 'apiQueryLocal should have given some result').to.be.equal(true);

    expect(this.state.apiQueryLocalResponse.length, 'Response should contain preciselly one item').to.be.equal(1);
    expect(this.state.apiQueryLocalResponse[0], 'Response should match import id').to.be.equal(this.state.lastImport.import_id);
});

Then(/^api-query-local-import response should have certain structure$/, function () {
    expect(!!this.state.apiQueryLocalImportResponse, 'apiQueryLocalImport should have given some result').to.be.equal(true);

    expect(this.state.apiQueryLocalImportResponse.length, 'Response should contain preciselly one item').to.be.equal(1);
    expect(this.state.apiQueryLocalImportResponse[0], 'Response should match import id').to.be.equal(this.state.lastImport.import_id);
});

Then(/^api-query-local-import-importId response should have certain structure$/, function () {
    expect(!!this.state.apiQueryLocalImportByImportIdResponse, 'apiQueryLocalImportByImportId should have given some result').to.be.equal(true);

    expect(Object.keys(this.state.apiQueryLocalImportByImportIdResponse), 'response should contain edges and vertices').to.have.members(['edges', 'vertices']);
    // check that lastImport.import_hash and sha256 calculated hash are matching
    const calculatedImportHash = ImportUtilities.importHash(this.state.apiQueryLocalImportByImportIdResponse.vertices, this.state.apiQueryLocalImportByImportIdResponse.edges);
    expect(this.state.lastImport.import_hash, 'Hashes should match').to.be.equal(calculatedImportHash);
});
