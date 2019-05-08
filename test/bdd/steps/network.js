/* eslint-disable no-unused-expressions, max-len */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const BN = require('bn.js');
const sleep = require('sleep-async')().Promise;
const request = require('request');
const _ = require('lodash');
const { deepEqual } = require('jsprim');

const OtNode = require('./lib/otnode');
const ImportUtilities = require('../../../modules/ImportUtilities');
const LocalBlockchain = require('./lib/local-blockchain');
const httpApiHelper = require('./lib/http-api-helper');
const utilities = require('./lib/utilities');
const Models = require('../../../models');

// Identity difficulty 8.
const bootstrapIdentity = {
    ff62cb1f692431d901833d55b93c7d991b4087f1: {
        xprivkey: 'xprv9s21ZrQH143K3HeLBdzpC75mK2nW8HSsrLRm7RU7yS3W6hNQFibGTYiWpAKAsJm6LQPyp6khWQ5mGvFVPeMqehQj1pUCkTWMTw1G5HHJow5',
        index: 1610612758,
    },
};

/**
 * Unpacks cucumber dictionary into simple dictionary
 * @param rawTable
 */
function unpackRawTable(rawTable) {
    const parse = (val) => {
        if (!Number.isNaN(Number(val))) {
            return Number(val);
        }

        if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
            return Boolean(val);
        }

        return val;
    };

    const unpacked = {};
    if (rawTable) {
        for (const row of rawTable.rawTable) {
            let value;
            if (row.length > 2) {
                value = [];
                for (let index = 1; index < row.length; index += 1) {
                    if (!row[index] != null && row[index] !== '') {
                        value.push(parse(row[index]));
                    }
                }
            } else {
                value = parse(row[1]);
            }

            const keyParts = row[0].split('.');
            if (keyParts.length === 1) {
                unpacked[keyParts[0]] = value;
            } else {
                let current = unpacked;
                for (let j = 0; j < keyParts.length - 1; j += 1) {
                    if (!current[keyParts[j]]) {
                        current[keyParts[j]] = {};
                    }
                    current = current[keyParts[j]];
                }
                current[keyParts[keyParts.length - 1]] = value;
            }
        }
    }
    return unpacked;
}

Given(/^(\d+) bootstrap is running$/, { timeout: 80000 }, function (nodeCount, done) {
    expect(this.state.bootstraps).to.have.length(0);
    expect(nodeCount).to.be.equal(1); // Currently not supported more.

    const walletCount = LocalBlockchain.wallets().length;

    const bootstrapNode = new OtNode({
        nodeConfiguration: {
            node_wallet: LocalBlockchain.wallets()[walletCount - 1].address,
            node_private_key: LocalBlockchain.wallets()[walletCount - 1].privateKey,
            management_wallet: LocalBlockchain.wallets()[walletCount - 1].address,
            is_bootstrap_node: true,
            local_network_only: true,
            database: {
                database: `origintrail-test-${uuidv4()}`,
            },
            blockchain: {
                hub_contract_address: this.state.localBlockchain.hubContractAddress,
                rpc_server_url: 'http://localhost:7545/', // TODO use from instance
            },
            network: {
                // TODO: Connect other if using multiple.
                bootstraps: ['https://localhost:5278/#ff62cb1f692431d901833d55b93c7d991b4087f1'],
                remoteWhitelist: ['localhost', '127.0.0.1'],
            },
            initial_deposit_amount: '10000000000000000000000',

        },
        appDataBaseDir: this.parameters.appDataBaseDir,
    });

    bootstrapNode.options.identity = bootstrapIdentity.ff62cb1f692431d901833d55b93c7d991b4087f1;
    bootstrapNode.initialize();
    this.state.bootstraps.push(bootstrapNode);

    bootstrapNode.once('initialized', () => done());
    bootstrapNode.start();
});

Given(/^I setup (\d+) node[s]*$/, { timeout: 120000 }, function (nodeCount, done) {
    expect(nodeCount).to.be.lessThan(LocalBlockchain.wallets().length - 1);

    for (let i = 0; i < nodeCount; i += 1) {
        const nodeConfiguration = {
            node_wallet: LocalBlockchain.wallets()[i].address,
            node_private_key: LocalBlockchain.wallets()[i].privateKey,
            management_wallet: LocalBlockchain.wallets()[i].address,
            node_port: 6000 + i,
            node_rpc_port: 9000 + i,
            node_remote_control_port: 4000 + i,
            network: {
                bootstraps: this.state.bootstraps.map(bootstrap =>
                    `${bootstrap.state.node_url}/#${bootstrap.state.identity}`),
                remoteWhitelist: ['localhost', '127.0.0.1'],
            },
            database: {
                database: `origintrail-test-${uuidv4()}`,
            },
            blockchain: {
                hub_contract_address: this.state.localBlockchain.hubContractAddress,
                rpc_server_url: 'http://localhost:7545/', // TODO use from instance
            },
            local_network_only: true,
            dc_choose_time: 60000, // 1 minute
            initial_deposit_amount: '10000000000000000000000',
        };

        const newNode = new OtNode({
            nodeConfiguration,
            appDataBaseDir: this.parameters.appDataBaseDir,
        });
        this.state.nodes.push(newNode);
        newNode.initialize();
        this.logger.log(`Node set up at ${newNode.options.configDir}`);
    }
    done();
});

Given(/^I wait for (\d+) second[s]*$/, { timeout: 600000 }, waitTime => new Promise((accept) => {
    expect(waitTime, 'waiting time should be less then step timeout').to.be.lessThan(600);
    setTimeout(accept, waitTime * 1000);
}));

Given(/^DC waits for holding time*$/, { timeout: 120000 }, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    const { dc } = this.state;

    const waitTime = Number(dc.options.nodeConfiguration.dc_holding_time_in_minutes) * 60 * 1000;
    expect(waitTime, 'waiting time in BDD tests should be less then step timeout').to.be.lessThan(120000);
    await sleep.sleep(waitTime);
});

Given(/^I start the node[s]*$/, { timeout: 3000000 }, function (done) {
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

Given(/^I stop the node[s]*$/, { timeout: 3000000 }, function () {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const nodesStops = [];

    this.state.nodes.forEach((node) => {
        nodesStops.push(new Promise((accept, reject) => {
            node.once('finished', () => accept());
            node.once('error', reject);
        }));
        node.stop();
    });

    return Promise.all(nodesStops);
});

Given(/^I start the (\d+)[st|nd|rd|th]+ node$/, { timeout: 3000000 }, function (nodeIndex) {
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const node = this.state.nodes[nodeIndex - 1];
    expect(node.isRunning, 'Node should not work.').to.be.false;
    node.start();

    return new Promise((accept, reject) => {
        node.once('initialized', () => accept());
        node.once('error', reject);
    });
});


Given(/^I stop the (\d+)[st|nd|rd|th]+ node$/, { timeout: 3000000 }, function (nodeIndex) {
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const node = this.state.nodes[nodeIndex - 1];
    expect(node.isRunning, 'Node should work.').to.be.true;
    node.stop();

    return new Promise((accept, reject) => {
        node.once('finished', () => accept());
        node.once('error', reject);
    });
});

Given(/^I stop \[(.+)\] nodes[s]*$/, { timeout: 3000000 }, function (nodeIndicesString) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const nodeIndices = JSON.parse(`[${nodeIndicesString}]`);
    expect(nodeIndices, 'Provide at least one index.').to.have.lengthOf.above(0);
    expect(nodeIndices, 'Indices out boundaries.').to
        .satisfy(indices => indices.reduce((acc, index) => (index - 1 >= 0 && index <= this.state.nodes.length), true));
    expect(nodeIndices, 'Node expected to be running.').to
        .satisfy(indices => indices.reduce((acc, index) => this.state.nodes[index - 1].isRunning, true));

    const nodesStops = [];

    nodeIndices.forEach((index) => {
        const node = this.state.nodes[index - 1];
        nodesStops.push(new Promise((accept, reject) => {
            node.once('finished', () => accept());
            node.once('error', reject);
        }));
        node.stop();
    });

    return Promise.all(nodesStops);
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

Given(/^I use (\d+)[st|nd|rd|th]+ node as ([DC|DH|DV|DV2]+)$/, function (nodeIndex, nodeType) {
    expect(nodeType, 'Node type can only be DC, DH, DV or DV2.').to.satisfy(val => (val === 'DC' || val === 'DH' || val === 'DV' || val === 'DV2'));
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    this.logger.log(`Setting node '${nodeIndex}' as ${nodeType}.`);
    this.state[nodeType.toLowerCase()] = this.state.nodes[nodeIndex - 1];
});

Then(/^([DC|DV]+)'s last [import|purchase]+'s hash should be the same as one manually calculated$/, async function (nodeType) {
    expect(nodeType, 'Node type can only be DC or DV.').to.satisfy(val => (val === 'DC' || val === 'DV'));
    expect(!!this.state[nodeType.toLowerCase()], 'DC/DV node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);

    const myNode = this.state[nodeType.toLowerCase()];

    const response = await httpApiHelper.apiImportInfo(myNode.state.node_rpc_url, this.state.lastImport.data_set_id);

    expect(response, 'response should contain root_hash, import, transaction and data_provider_wallet keys').to.have.keys([
        'root_hash', 'import',
        'transaction', 'data_provider_wallet',
    ]);

    expect(response.import, 'response.import should contain vertices and edges').to.have.keys(['vertices', 'edges']);

    const calculatedImportHash = utilities.calculateImportHash(response.import);
    expect(calculatedImportHash, `Calculated hash differs: ${calculatedImportHash} !== ${this.state.lastImport.data_set_id}.`).to.be.equal(this.state.lastImport.data_set_id);
});

Then(/^the last root hash should be the same as one manually calculated$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);

    const { dc } = this.state;

    const myFingerprint = await httpApiHelper.apiFingerprint(dc.state.node_rpc_url, this.state.lastImport.data_set_id);
    expect(myFingerprint).to.have.keys(['root_hash']);
    expect(utilities.isZeroHash(myFingerprint.root_hash), 'root hash value should not be zero hash').to.be.equal(false);


    const myApiImportInfo = await httpApiHelper.apiImportInfo(dc.state.node_rpc_url, this.state.lastImport.data_set_id);
    // vertices and edges are already sorted from the response
    const myMerkle = await ImportUtilities.merkleStructure(myApiImportInfo.import.vertices, myApiImportInfo.import.edges);

    expect(myFingerprint.root_hash, 'Fingerprint from API endpoint and manually calculated should match').to.be.equal(myMerkle.tree.getRoot());
});

Given(/^I wait for replication[s] to finish$/, { timeout: 1200000 }, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const promises = [];

    // All nodes including DC emit offer-finalized.
    this.state.nodes.filter(node => node.isRunning).forEach((node) => {
        promises.push(new Promise((acc) => {
            node.once('offer-finalized', (offerId) => {
                // TODO: Change API to connect internal offer ID and external offer ID.
                acc();
            });
        }));
    });

    return Promise.all(promises);
});

Given(/^I wait for (\d+)[st|nd|rd|th]+ node to verify replication$/, { timeout: 1200000 }, function (nodeIndex) {
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const node = this.state.nodes[nodeIndex - 1];
    const { dc } = this.state;

    expect(node.isRunning).to.be.true;
    expect(dc, 'DC not defined.').not.to.be.undefined;

    return new Promise((accept) => {
        dc.on('dh-replication-verified', (nodeId) => {
            if (nodeId === node.state.identity) {
                accept();
            }
        });
    });
});

Then(/^the last import should be the same on all nodes that replicated data$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;

    // Expect everyone running to have data
    expect(
        dc.state.replications.length,
        'Not every node replicated data.',
    ).to.equal(this.state.nodes.reduce((acc, node) => acc + node.isRunning, -1)); // Start from -1. DC is not counted.

    // Get offer ID for last import.
    const lastOfferId =
        dc.state.offers.internalIDs[this.state.lastReplication.replication_id].offerId;

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
        if (dc.state.offers.internalIDs[internalOfferId].dataSetId ===
            this.state.lastImport.data_set_id) {
            const node =
                this.state.nodes.find(node => node.state.identity === dhId);

            if (!node) {
                throw Error(`Failed to find node with ID: ${dhId}.`);
            }

            promises.push(new Promise(async (accept, reject) => {
                const dhImportInfo =
                    await httpApiHelper.apiImportInfo(
                        node.state.node_rpc_url,
                        this.state.lastImport.data_set_id,
                    );
                expect(dhImportInfo.transaction, 'DH transaction hash should be defined').to.not.be.undefined;
                if (deepEqual(dcImportInfo, dhImportInfo)) {
                    accept();
                } else {
                    reject(Error(`Objects not equal: ${JSON.stringify(dcImportInfo)} ` +
                        `and ${JSON.stringify(dhImportInfo)}`));
                }
            }));
        }
    });

    return Promise.all(promises);
});

Then(/^the last import should be the same on DC and ([DV|DV2]+) nodes$/, async function (whichDV) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state[whichDV.toLowerCase()], 'DV/DV2 node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(this.state.lastQueryNetworkId, 'Query not published yet.').to.not.be.undefined;

    const { dc } = this.state;
    const dv = this.state[whichDV.toLowerCase()];
    const dataSetId = this.state.lastImport.data_set_id;

    // Expect DV to have data.
    expect(
        dv.state.purchasedDatasets,
        `Data-set ${dataSetId} was not purchased.`,
    ).to.have.key(dataSetId);

    // Get original import info.
    const dcImportInfo =
        await httpApiHelper.apiImportInfo(dc.state.node_rpc_url, this.state.lastImport.data_set_id);
    const dvImportInfo =
        await httpApiHelper.apiImportInfo(dv.state.node_rpc_url, this.state.lastImport.data_set_id);

    if (!deepEqual(dcImportInfo, dvImportInfo)) {
        throw Error(`Objects not equal: ${JSON.stringify(dcImportInfo)} and ${JSON.stringify(dvImportInfo)}`);
    }
    expect(dcImportInfo.transaction, 'DC transaction hash should be defined').to.not.be.undefined;
    expect(dvImportInfo.transaction, 'DV/DV2 transaction hash should be defined').to.not.be.undefined;
});

Given(/^I remember previous import's fingerprint value$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodesWalletAddress !== 'null', 'Nodes wallet should be non null value').to.be.equal(true);

    const { dc } = this.state;

    const myFingerprint =
        await httpApiHelper.apiFingerprint(
            dc.state.node_rpc_url,
            this.state.lastImport.data_set_id,
        );
    expect(myFingerprint).to.have.keys(['root_hash']);
    expect(utilities.isZeroHash(myFingerprint.root_hash), 'root hash value should not be zero hash').to.be.equal(false);

    // TODO need better namings
    this.state.lastMinusOneImportFingerprint = myFingerprint;
    this.state.lastMinusOneImport = this.state.lastImport;
});

Then(/^checking again first import's root hash should point to remembered value$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodesWalletAddress !== 'null', 'Nodes wallet should be non null value').to.be.equal(true);

    const { dc } = this.state;

    const firstImportFingerprint =
        await httpApiHelper.apiFingerprint(
            dc.state.node_rpc_url,
            this.state.lastMinusOneImport.data_set_id,
        );
    expect(firstImportFingerprint).to.have.keys(['root_hash']);
    expect(utilities.isZeroHash(firstImportFingerprint.root_hash), 'root hash value should not be zero hash').to.be.equal(false);

    expect(firstImportFingerprint.root_hash)
        .to.be.equal(this.state.lastMinusOneImportFingerprint.root_hash);
    expect(
        deepEqual(firstImportFingerprint, this.state.lastMinusOneImportFingerprint),
        'import and root has in both scenario should be indentical',
    ).to.be.equal(true);
});

Then(/^response should contain only last imported data set id$/, function () {
    expect(!!this.state.apiQueryLocalResponse, 'apiQueryLocal should have given some result').to.be.equal(true);

    expect(this.state.apiQueryLocalResponse.length, 'Response should contain preciselly one item').to.be.equal(1);
    expect(this.state.apiQueryLocalResponse[0], 'Response should match data_set_id').to.be.equal(this.state.lastImport.data_set_id);
});

Then(/^response hash should match last imported data set id$/, function () {
    expect(!!this.state.apiQueryLocalImportByDataSetIdResponse, 'apiQueryLocalImportByDataSetId should have given some result').to.be.equal(true);

    expect(Object.keys(this.state.apiQueryLocalImportByDataSetIdResponse), 'response should contain edges and vertices').to.have.members(['edges', 'vertices']);
    // check that lastImport.data_set_id and sha256 calculated hash are matching
    const calculatedImportHash = utilities.calculateImportHash(this.state.apiQueryLocalImportByDataSetIdResponse);
    expect(this.state.lastImport.data_set_id, 'Hashes should match').to.be.equal(calculatedImportHash);
});

Given(/^I additionally setup (\d+) node[s]*$/, { timeout: 30000 }, function (nodeCount, done) {
    const nodeCountSoFar = this.state.nodes.length;
    expect(nodeCount).to.be.lessThan(LocalBlockchain.wallets().length - nodeCountSoFar);

    for (let i = nodeCountSoFar; i < nodeCountSoFar + nodeCount; i += 1) {
        const newNode = new OtNode({
            nodeConfiguration: {
                node_wallet: LocalBlockchain.wallets()[i].address,
                node_private_key: LocalBlockchain.wallets()[i].privateKey,
                management_wallet: LocalBlockchain.wallets()[i].address,
                node_port: 6000 + i,
                node_rpc_port: 9000 + i,
                node_remote_control_port: 4000 + i,
                network: {
                    bootstraps: this.state.bootstraps.map(bootstrap =>
                        `${bootstrap.state.node_url}/#${bootstrap.state.identity}`),
                    remoteWhitelist: ['localhost', '127.0.0.1'],
                },
                database: {
                    database: `origintrail-test-${uuidv4()}`,
                },
                blockchain: {
                    hub_contract_address: this.state.localBlockchain.hubContractAddress,
                    rpc_server_url: 'http://localhost:7545/', // TODO use from instance
                },
                local_network_only: true,
                initial_deposit_amount: '10000000000000000000000',
            },
            appDataBaseDir: this.parameters.appDataBaseDir,
        });
        this.state.nodes.push(newNode);
        newNode.initialize();
        this.logger.log(`Additional node set up at ${newNode.options.configDir}`);
    }
    done();
});

Given(/^I start additional node[s]*$/, { timeout: 5 * 60000 }, function () {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);
    const additionalNodesStarts = [];
    this.state.nodes.forEach((node) => {
        if (!node.isRunning) {
            additionalNodesStarts.push(new Promise((accept) => {
                node.once('initialized', () => accept());
            }));
        }
        if (!node.started) {
            node.start();
        }
    });

    return Promise.all(additionalNodesStarts);
});

Then(/^all nodes with (last import|second last import) should answer to last network query by ([DV|DV2]+)$/, { timeout: 90000 }, async function (whichImport, whichDV) {
    expect(whichImport, 'last import or second last import are allowed values').to.be.oneOf(['last import', 'second last import']);
    whichImport = (whichImport === 'last import') ? 'lastImport' : 'secondLastImport';
    expect(!!this.state[whichDV.toLowerCase()], 'DV/DV2 node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.lastQueryNetworkId, 'Query not published yet.').to.not.be.undefined;
    expect(!!this.state[whichImport], 'Nothing was imported. Use other step to do it.').to.be.equal(true);

    const dv = this.state[whichDV.toLowerCase()];

    // Check which node has last import.
    const promises = [];
    const nodeCandidates = [];
    this.state.nodes.forEach((node) => {
        promises.push(new Promise(async (accept) => {
            const body = await httpApiHelper.apiImportsInfo(node.state.node_rpc_url);
            body.find((importInfo) => {
                if (importInfo.data_set_id === this.state[whichImport].data_set_id) {
                    nodeCandidates.push(node.state.identity);
                    return true;
                }
                return false;
            });
            // TODO check that nodeCandidates [] elements are all unique values, there must not be dupes
            accept();
        }));
    });

    await Promise.all(promises);

    expect(nodeCandidates.length).to.be.greaterThan(0);


    // At this point all data location queries can be placed hence we wait.
    const queryId = this.state.lastQueryNetworkId;

    const startTime = Date.now();
    return new Promise((accept, reject) => {
        // const intervalHandler;
        const intervalHandler = setInterval(async () => {
            const confirmationsSoFar =
                dv.nodeConfirmsForDataSetId(queryId, this.state[whichImport].data_set_id);
            if (Date.now() - startTime > 60000) {
                clearTimeout(intervalHandler);
                reject(Error('Not enough confirmations for query. ' +
                    `Candidates: ${JSON.stringify(nodeCandidates)}, ` +
                    `confirmations: ${JSON.stringify(confirmationsSoFar)}`));
            }
            if (confirmationsSoFar.length === nodeCandidates.length) {
                clearTimeout(intervalHandler);
                accept();
            }
        }, 3000);
    });
});

Then(/^DC wallet and DC profile balances should diff by (\d+) with rounding error of (\d+.\d{1,2})$/, function (tokenDiff, roundingError) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    const { dc } = this.state;

    expect(!!dc.state.newProfileBalance, 'newProfileBalance node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!dc.state.oldProfileBalance, 'oldProfileBalance node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!dc.state.newWalletBalance, 'newWalletBalance node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!dc.state.oldWalletBalance, 'oldWalletBalance node not defined. Use other step to define it.').to.be.equal(true);

    const lowerLimit = tokenDiff - roundingError;
    const upperLimit = tokenDiff + roundingError;
    expect(Math.abs(dc.state.oldProfileBalance - dc.state.newProfileBalance) < upperLimit, 'Profile diff should be approx equal to withdrawal amount').to.be.true;
    expect(Math.abs(dc.state.newWalletBalance - dc.state.oldWalletBalance) > lowerLimit, 'Wallet diff should be approx equal to withdrawal amount').to.be.true;
});

Then(/^last consensus response should have (\d+) event with (\d+) match[es]*$/, function (eventsCount, matchesCount) {
    expect(this.state.lastConsensusResponse, 'lastConsensusResponse should be already defined').to.not.be.undefined;
    expect(this.state.lastConsensusResponse, 'Should have key called events').to.have.all.keys('events');

    const consensusEvents = this.state.lastConsensusResponse.events;
    expect(consensusEvents, 'should be an Array').to.be.an.instanceof(Array);
    expect(consensusEvents.length).to.be.equal(eventsCount);

    let consesusMatches = 0;
    consensusEvents.forEach((myElement) => {
        if (Object.keys(myElement).toString() === 'side1,side2') {
            consesusMatches += 1;
        }
    });
    expect(consesusMatches).to.be.equal(matchesCount);
});

Given(/^DC waits for replication window to close$/, { timeout: 180000 }, function (done) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('replication-window-closed', () => {
        done();
    });
});

Given(/^DC waits for last offer to get written to blockchain$/, { timeout: 180000 }, function (done) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplication, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('offer-written-blockchain', () => {
        done();
    });
});

Given(/^API calls will be forbidden/, { timeout: 180000 }, function (done) {
    const { dc } = this.state;

    const methods = Object.keys(httpApiHelper);
    methods.splice(methods.indexOf('apiImport'), 1); // we're already handling import content

    const promises = [];
    for (const method of methods) {
        promises.push(new Promise((resolve, reject) => {
            httpApiHelper[method](dc.state.node_rpc_url).then((response) => {
                if (response == null) {
                    reject(new Error('No response'));
                    return;
                }
                if (response.message !== 'Forbidden request') {
                    reject(new Error('Request is not forbidden'));
                    return;
                }
                resolve();
            }).catch(err => reject(err));
        }));
    }
    Promise.all(promises).then(() => done());
});

Given(/^API calls will not be authorized/, { timeout: 180000 }, function (done) {
    const { dc } = this.state;

    const methods = Object.keys(httpApiHelper);
    methods.splice(methods.indexOf('apiImport'), 1); // we're already handling import content

    const promises = [];
    for (const method of methods) {
        promises.push(new Promise((resolve, reject) => {
            httpApiHelper[method](dc.state.node_rpc_url).then((response) => {
                if (response == null) {
                    reject(new Error('No response'));
                    return;
                }
                if (response.message !== 'Failed to authorize. Auth token is missing') {
                    reject(new Error('Request is authorized'));
                    return;
                }
                resolve();
            }).catch(err => reject(err));
        }));
    }
    Promise.all(promises).then(() => done());
});

Given(/^I override configuration for all nodes*$/, { timeout: 120000 }, function (configuration, done) {
    const configurationOverride = unpackRawTable(configuration);

    for (const node of this.state.nodes) {
        node.overrideConfiguration(configurationOverride);
        this.logger.log(`Configuration updated for node ${node.id}`);
    }
    done();
});

Given(/^(\d+)[st|nd|rd|th]+ bootstrap should reply on info route$/, { timeout: 3000000 }, async function (nodeIndex) {
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.bootstraps.length);

    const bootstrap = this.state.bootstraps[nodeIndex - 1];
    const response = await httpApiHelper.apiNodeInfo(bootstrap.state.node_rpc_url);

    expect(response, 'response should contain version, blockchain, network and is_bootstrap keys').to.have.keys([
        'version', 'blockchain',
        'network', 'is_bootstrap',
    ]);
});

Given(/^selected DHes should be payed out*$/, { timeout: 180000 }, async function () {
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);

    const myPromises = [];

    // slice(1) to exlude DC node
    this.state.nodes.slice(1).forEach((node) => {
        myPromises.push(new Promise((accept) => {
            // node.state.takenBids gets populated only for choosen DH nodes
            if (node.state.takenBids.length === 1) {
                node.once('dh-pay-out-finalized', async () => {
                    const myBalance = await httpApiHelper.apiBalance(node.state.node_rpc_url, false);
                    const a = new BN(myBalance.profile.staked);
                    const b = new BN(node.options.nodeConfiguration.initial_deposit_amount);
                    const c = new BN(node.options.nodeConfiguration.dc_token_amount_per_holder);
                    expect(a.sub(b).toString()).to.be.equal(c.toString());
                    accept();
                });
            } else {
                accept();
            }
        }));
    });

    return Promise.all(myPromises);
});

Given(/^selected DHes should not be payed out*$/, { timeout: 180000 }, async function () {
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);

    const { dc } = this.state;
    const myPromises = [];

    this.state.nodes.forEach((node) => {
        if (node === dc) {
            // Skip the DC node.
            return;
        }
        myPromises.push(new Promise(async (accept, reject) => {
            // Check each node for payout command.

            Models.sequelize.options.storage = node.systemDbPath;
            await Models.sequelize.sync();
            const payOutCommands = await Models.sequelize.models.commands.findAll({
                where: {
                    name: 'dhPayOutCommand',
                },
            });

            if (payOutCommands.length === 0) {
                accept();
            } else {
                reject(Error('Command dhPayOutCommand should not be scheduled.'));
            }
        }));
    });

    return Promise.all(myPromises);
});

Given(/^I set (\d+)[st|nd|rd|th]+ node's management wallet to be different then operational wallet$/, { timeout: 3000000 }, function (nodeIndex) {
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const wallets = LocalBlockchain.wallets();
    const walletCount = LocalBlockchain.wallets().length;

    const operationalWallet = this.state.nodes[nodeIndex - 1].options.nodeConfiguration.node_wallet;
    let managementWallet = this.state.nodes[nodeIndex - 1].options.nodeConfiguration.management_wallet;
    let randomIndex;
    expect(operationalWallet, 'At this point operational and management wallets should be identical').to.be.equal(managementWallet);

    while (managementWallet === operationalWallet) {
        // position walletCount-1 is reserved for bootstrap node
        randomIndex = _.random(0, walletCount - 2);
        managementWallet = wallets[randomIndex].address;
    }
    expect(operationalWallet, 'At this point operational and management wallets should not be identical').to.not.be.equal(managementWallet);
});


Given('I wait for DC to fail to finalize last offer', { timeout: 600000 }, function (done) {
    const promises = [];
    promises.push(new Promise((acc) => {
        this.state.dc.once('not-enough-dhs', () => {
            acc();
        });
    }));

    Promise.all(promises).then(() => done());
});
