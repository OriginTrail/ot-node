/* eslint-disable no-unused-expressions, max-len */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { assert, expect } = require('chai');
const uuidv4 = require('uuid/v4');
const BN = require('bn.js');
const sleep = require('sleep-async')().Promise;
const request = require('request');
const _ = require('lodash');
const { deepEqual } = require('jsprim');
const path = require('path');

const OtNode = require('./lib/otnode');
const ImportUtilities = require('../../../modules/ImportUtilities');
const Utilities = require('../../../modules/Utilities');
const LocalBlockchain = require('./lib/local-blockchain');
const httpApiHelper = require('./lib/http-api-helper');
const utilities = require('./lib/utilities');
const modulesUtilities = require('../../../modules/Utilities');
const Models = require('../../../models');
const fs = require('fs');
const xmljs = require('xml-js');

const Web3 = require('web3');


// Identity difficulty 8.
const bootstrapIdentity = {
    ff62cb1f692431d901833d55b93c7d991b4087f1: {
        privateKey: '9627b68c24de09f1566b4b8c9ff32b6909ffe676d3e610c69c38556a0823841b',
        nonce: 8,
        proof: '675c0000728c00000e030000382a000098310000a99a00004b53000033ca000044a00000ecc60000b0c400004ae100001b2f0000258900005a8d0000d1b00000b929000070860000701700004672000073a50000c2be0000a65c00004d8e00005e410000137d000091090000c9aa0000baa00000fade000014050000cce40000',
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
    this.logger.log(`I setup ${nodeCount} nodes`);

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
            dc_choose_time: 90000, // 90 seconds
            initial_deposit_amount: '10000000000000000000000',
            commandExecutorVerboseLoggingEnabled: true,
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

Given(/^DC waits for holding time*$/, { timeout: 180000 }, async function () {
    this.logger.log('DC waits for holding time');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    const { dc } = this.state;

    const waitTime = Number(dc.options.nodeConfiguration.dc_holding_time_in_minutes) * 60 * 1000;
    expect(waitTime, 'waiting time in BDD tests should be less then step timeout').to.be.lessThan(180000);
    await sleep.sleep(waitTime);
});

Given(/^I start the node[s]*$/, { timeout: 3000000 }, function (done) {
    this.logger.log('I start the nodes');
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

Given(/^I use (\d+)[st|nd|rd|th]+ node as ([DC|DH|DV|DV2]+)$/, function (nodeIndex, nodeType) {
    expect(nodeType, 'Node type can only be DC, DH, DV or DV2.').to.satisfy(val => (val === 'DC' || val === 'DH' || val === 'DV' || val === 'DV2'));
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    this.logger.log(`Setting node '${nodeIndex}' as ${nodeType}.`);
    this.state[nodeType.toLowerCase()] = this.state.nodes[nodeIndex - 1];

    if (this.state.lastIssuerIdentity) {
        this.state.secondLastIssuerIdentity = this.state.lastIssuerIdentity;
    }
    this.state.lastIssuerIdentity = JSON.parse(fs.readFileSync(`${this.state[nodeType.toLowerCase()].options.configDir}/${this.state[nodeType.toLowerCase()].options.nodeConfiguration.erc725_identity_filepath}`).toString());
});

Then(/^([DC|DV]+)'s last [import|purchase]+'s hash should be the same as one manually calculated$/, async function (nodeType) {
    this.logger.log(`${nodeType} last import/purchase hash should be the same as one manually calculated`);
    expect(nodeType, 'Node type can only be DC or DV.').to.satisfy(val => (val === 'DC' || val === 'DV'));
    expect(!!this.state[nodeType.toLowerCase()], 'DC/DV node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);

    const myNode = this.state[nodeType.toLowerCase()];

    const response = await httpApiHelper.apiImportInfo(myNode.state.node_rpc_url, this.state.lastImport.data.dataset_id);

    expect(response, 'response should contain root_hash, dataSetId, document, transaction and data_provider_wallet keys').to.have.keys([
        'dataSetId', 'root_hash', 'document',
        'transaction', 'data_provider_wallet',
    ]);

    expect(response.document, 'response.document should be in OT JSON format')
        .to.have.keys(['datasetHeader', '@id', '@type', '@graph', 'signature']);


    expect(ImportUtilities.extractDatasetSigner(response.document, new Web3()).toLowerCase() === myNode.options.nodeConfiguration.node_wallet, 'Signature not valid!').to.be.true;

    const calculatedRootHash = ImportUtilities.calculateDatasetRootHash(response.document);
    const calculateDatasetId = ImportUtilities.calculateGraphPublicHash(response.document);
    expect(calculatedRootHash, `Calculated hash differs: ${calculatedRootHash} !== ${this.state.lastImport.root_hash}.`).to.be.equal(this.state.lastImport.data.root_hash);
    expect(calculateDatasetId, `Calculated data-set ID differs: ${calculateDatasetId} !== ${this.state.lastImport.data.dataset_id}.`).to.be.equal(this.state.lastImport.data.dataset_id);
});

Then(/^the last exported dataset signature should belong to ([DC|DV]+)$/, async function (nodeType) {
    expect(nodeType, 'Node type can only be DC or DV.').to.satisfy(val => (val === 'DC' || val === 'DV'));
    expect(!!this.state[nodeType.toLowerCase()], 'DC/DV node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(!!this.state.lastExport, 'Last export didn\'t happen. Use other step to do it.').to.be.equal(true);

    const myNode = this.state[nodeType.toLowerCase()];

    const { lastExport } = this.state;

    expect(lastExport, 'response should contain data and status keys').to.have.keys([
        'data', 'status',
    ]);

    expect(lastExport.status, 'response.status should be "COMPLETED"')
        .to.be.equal('COMPLETED');

    lastExport.data.formatted_dataset = JSON.parse(lastExport.data.formatted_dataset);
    expect(lastExport.data.formatted_dataset, 'response.data.formatted_dataset should be in OT JSON format')
        .to.have.keys(['datasetHeader', '@id', '@type', '@graph', 'signature']);

    expect(ImportUtilities.extractDatasetSigner(lastExport.data.formatted_dataset, new Web3()).toLowerCase() === myNode.options.nodeConfiguration.node_wallet.toLowerCase(), 'Signature not valid!').to.be.true;
});

Then(/^the last exported dataset should contain "([^"]*)" data as "([^"]*)"$/, async function (filePath, dataId) {
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(!!this.state.lastExport, 'Last export didn\'t happen. Use other step to do it.').to.be.equal(true);

    const ot_logo = utilities.base64_encode(path.resolve(__dirname, filePath));

    const { lastExport } = this.state;

    expect(lastExport.status, 'response.status should be "COMPLETED"')
        .to.be.equal('COMPLETED');

    lastExport.data.formatted_dataset = JSON.parse(lastExport.data.formatted_dataset);
    expect(lastExport.data.formatted_dataset, 'response.data.formatted_dataset should be in OT JSON format')
        .to.have.keys(['datasetHeader', '@id', '@type', '@graph', 'signature']);

    expect(lastExport.data.formatted_dataset['@graph']
        .find(x => x['@id'] === dataId).properties['urn:ot:object:product:batch:image'])
        .to.be.equal(ot_logo);
});

Then(/^the last exported dataset data should be the same as "([^"]*)"$/, async function (importedFilePath) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(!!this.state.lastExport, 'Last export didn\'t happen. Use other step to do it.').to.be.equal(true);

    const { lastExport } = this.state;

    expect(lastExport, 'response should contain data and status keys').to.have.keys([
        'data', 'status',
    ]);
    let keys = ['formatted_dataset', 'data_creator', 'dc_node_wallet', 'transaction_hash'];
    if (lastExport.data.export_status) {
        expect(lastExport.data.export_status, 'response.data.export_status should be "COMPLETED"')
            .to.be.equal('COMPLETED');
        keys = keys.concat(['export_status', 'import_status', 'root_hash']);
        if (lastExport.data.import_status === 'COMPLETED') {
            keys = keys.concat(['offer_id', 'data_hash']);
        }
    } else {
        keys = keys.concat(['root_hash', 'data_hash']);
        expect(lastExport.status, 'response.status should be "COMPLETED"')
            .to.be.equal('COMPLETED');
    }

    expect(lastExport.data, 'response.data should have the formatted_dataset field')
        .to.have.keys(keys);

    if (this.state.lastExportType === 'GS1-EPCIS') {
        const exportedXml = xmljs.xml2js(lastExport.data.formatted_dataset, {
            compact: true,
            spaces: 4,
        });
        let originalXml = await fs.readFileSync(importedFilePath, 'utf8');
        originalXml = xmljs.xml2js(originalXml, {
            compact: true,
            spaces: 4,
        });

        assert.deepEqual(
            utilities.stringifyWithoutComments(exportedXml),
            utilities.stringifyWithoutComments(originalXml),
            'Exported file not equal to imported one!',
        );
    } else {
        const originalJson = await fs.readFileSync(importedFilePath, 'utf8');

        assert.deepEqual(
            utilities.stringifyWithoutComments(JSON.parse(lastExport.data.formatted_dataset)),
            utilities.stringifyWithoutComments(JSON.parse(originalJson)),
            'Exported file not equal to imported one!',
        );
    }
});

Then(/^the last root hash should be the same as one manually calculated$/, async function () {
    this.logger.log('The last root hash should be the same as one manually calculated$');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplicationHandler, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);

    const { dc } = this.state;

    const fingerprint = await httpApiHelper.apiFingerprint(dc.state.node_rpc_url, this.state.lastImport.data.dataset_id);
    expect(fingerprint).to.have.keys(['root_hash']);
    expect(utilities.isZeroHash(fingerprint.root_hash), 'root hash value should not be zero hash').to.be.equal(false);


    const importInfo = await httpApiHelper.apiImportInfo(dc.state.node_rpc_url, this.state.lastImport.data.dataset_id);
    // vertices and edges are already sorted from the response

    const calculatedDataSetId = ImportUtilities.calculateGraphPublicHash(importInfo.document);
    const calculatedRootHash = ImportUtilities.calculateDatasetRootHash(importInfo.document);

    expect(fingerprint.root_hash, 'Fingerprint from API endpoint and manually calculated should match')
        .to.be.equal(calculatedRootHash);
    expect(this.state.lastImport.data.root_hash, 'Root hash from last import and manually calculated should match')
        .to.be.equal(calculatedRootHash);
    expect(this.state.lastImport.data.dataset_id, 'Dataset ID and manually calculated ID should match')
        .to.be.equal(calculatedDataSetId);
});

Then(/^the last two exported datasets from (\d+)[st|nd|rd|th]+ and (\d+)[st|nd|rd|th]+ node ([should|should not]+) have the same hashes$/, async function (nodeIndex1, nodeIndex2, condition) {
    this.logger.log('The last root hash should be the same as one manually calculated$');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastExport, 'Last export didn\'t happen. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.secondLastExport, 'Second last export didn\'t happen. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.secondLastImport, 'Second last import didn\'t happen. Use other step to do it.').to.be.equal(true);

    const dataset1 = JSON.parse(this.state.secondLastExport.data.formatted_dataset);
    const dataset2 = JSON.parse(this.state.lastExport.data.formatted_dataset);
    const dc1 = this.state.nodes[nodeIndex1 - 1];
    const dc2 = this.state.nodes[nodeIndex2 - 1];

    // check dataset_id
    const calculatedDatasetId1 = ImportUtilities.calculateGraphPublicHash(dataset1);
    expect(this.state.secondLastImport.data.dataset_id, 'Dataset from API endpoint and manually calculated should match')
        .to.be.equal(calculatedDatasetId1);

    // check signature
    const calcuatedDatasetSignature1 = ImportUtilities.extractDatasetSigner(dataset1, new Web3());
    expect(Utilities.normalizeHex(calcuatedDatasetSignature1), 'Dataset from API endpoint and manually calculated should match')
        .to.be.equal(Utilities.normalizeHex(dc1.options.nodeConfiguration.node_wallet));

    // check root_hash
    const calculatedDatasetRootHash1 = ImportUtilities.calculateDatasetRootHash(dataset1);
    expect(calculatedDatasetRootHash1, 'Dataset from API endpoint and manually calculated should match')
        .to.be.equal(this.state.secondLastExport.data.root_hash);

    // check dataset_id
    const calculatedDatasetId2 = ImportUtilities.calculateGraphPublicHash(dataset2);
    expect(this.state.lastImport.data.dataset_id, 'Dataset from API endpoint and manually calculated should match')
        .to.be.equal(calculatedDatasetId2);

    // check signature
    const calcuatedDatasetSignature2 = ImportUtilities.extractDatasetSigner(dataset2, new Web3());
    expect(Utilities.normalizeHex(calcuatedDatasetSignature2), 'Dataset from API endpoint and manually calculated should match')
        .to.be.equal(Utilities.normalizeHex(dc2.options.nodeConfiguration.node_wallet));

    // check root_hash
    const calculatedDatasetRootHash2 = ImportUtilities.calculateDatasetRootHash(dataset2);
    expect(calculatedDatasetRootHash2, 'Dataset from API endpoint and manually calculated should match')
        .to.be.equal(this.state.lastExport.data.root_hash);

    if (condition.includes('not')) {
        expect(calculatedDatasetId1).to.be.not.equal(calculatedDatasetId2);
        expect(calcuatedDatasetSignature1).to.be.not.equal(calcuatedDatasetSignature2);
        expect(calculatedDatasetRootHash1).to.be.not.equal(calculatedDatasetRootHash2);
    } else {
        expect(calculatedDatasetId1).to.be.equal(calculatedDatasetId2);
        expect(calcuatedDatasetSignature1).to.be.equal(calcuatedDatasetSignature2);
        expect(calculatedDatasetRootHash1).to.be.equal(calculatedDatasetRootHash2);
    }
});

Then(/^the last two datasets should have the same hashes$/, async function () {
    this.logger.log('The last root hash should be the same as one manually calculated$');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.secondLastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);

    expect(this.state.lastImport.data.dataset_id, 'Fingerprint from API endpoint and manually calculated should match')
        .to.be.equal(this.state.secondLastImport.data.dataset_id);
});

Given(/^I wait for replication[s] to finish$/, { timeout: 1800000 }, function () {
    this.logger.log('I wait for replication to finish');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplicationHandler, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const promises = [];

    // All nodes including DC emit offer-finalized.
    this.state.nodes.filter(node => node.isRunning).forEach((node) => {
        if (!this.state.corruptedNode || (node.id !== this.state.corruptedNode.id)) {
            promises.push(new Promise((accept, reject) => {
                node.once('offer-finalized', (offerId) => {
                    if (this.state.lastReplication !== offerId) {
                        if (this.state.lastReplication) {
                            this.state.secondLastReplication = this.state.lastReplication;
                        }
                        this.state.lastReplication = offerId;
                    }
                    // TODO: Change API to connect internal offer ID and external offer ID.
                    accept();
                });
                node.once('not-enough-dhs', (offerId) => {
                    if (this.state.lastReplication !== offerId) {
                        if (this.state.lastReplication) {
                            this.state.secondLastReplication = this.state.lastReplication;
                        }
                        this.state.lastReplication = offerId;
                    }
                    // TODO: Change API to connect internal offer ID and external offer ID.
                    reject(Error('Offer failed: Not enough DH\'s submitted'));
                });
            }));
        }
    });

    return Promise.all(promises);
});


Given(/^Last replication should fail$/, { timeout: 10000 }, async function () {
    this.logger.log('I wait for replication to finish');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplicationHandler, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    const { dc } = this.state;
    const response = await httpApiHelper.apiReplicationResult(dc.state.node_rpc_url, this.state.lastReplicationHandler.handler_id);
    expect(response.status).to.be.equal('FAILED');
});

Then(/^DC should send a challenge request$/, { timeout: 1200000 }, function () {
    this.logger.log('DC should send a challenge request$');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const { dh } = this.state;

    const promises = [];
    promises.push(new Promise((acc) => {
        dc.once(`dc-challenge-sent-${dh.state.identity}`, () => {
            acc();
        });
    }));

    return Promise.all(promises);
});

Then(/^DH should send the challenge response$/, { timeout: 1200000 }, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dh } = this.state;
    const promises = [];

    promises.push(new Promise((acc) => {
        dh.once('dh-challenge-sent', (answer) => {
            console.log('received and replied');
            if (this.state.lastCalculatedAnswer == null) {
                this.state.lastCalculatedAnswer = {};
            }
            this.state.lastCalculatedAnswer[dh.state.identity] = answer;
            acc();
        });
    }));

    return Promise.all(promises);
});

Then(/^DC should verify the response$/, { timeout: 1200000 }, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const { dh } = this.state;
    const answer = this.state.lastCalculatedAnswer[dh.state.identity];
    const promises = [];
    promises.push(new Promise((acc) => {
        dc.once(`dc-challenge-verified-${answer}`, () => {
            acc();
        });
    }));

    return Promise.all(promises);
});

Given(/^I wait for (\d+)[st|nd|rd|th]+ node to verify replication$/, { timeout: 1200000 }, function (nodeIndex) {
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplicationHandler, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
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
    this.logger.log('The last import should be the same on all nodes that replicated data');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplicationHandler, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;

    // Expect everyone running to have data
    expect(
        dc.state.replications.length,
        'Not every node replicated data.',
    ).to.equal(this.state.nodes.reduce((acc, node) => acc + node.isRunning, -1)); // Start from -1. DC is not counted.

    // Get offer ID for last import.
    const response = await httpApiHelper.apiReplicationResult(dc.state.node_rpc_url, this.state.lastReplicationHandler.handler_id);
    const lastOfferId = response.data.offer_id;

    // Assumed it hasn't been changed in between.
    const currentDifficulty =
        await this.state.localBlockchain.contracts.Holding.instance.methods.difficultyOverride().call();

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
        await httpApiHelper.apiImportInfo(dc.state.node_rpc_url, this.state.lastImport.data.dataset_id);

    const promises = [];
    dc.state.replications.forEach(({ internalOfferId, dhId }) => {
        if (dc.state.offers.internalIDs[internalOfferId].dataSetId ===
            this.state.lastImport.data.dataset_id) {
            const node =
                this.state.nodes.find(node => node.state.identity === dhId);

            if (!node) {
                throw Error(`Failed to find node with ID: ${dhId}.`);
            }

            promises.push(new Promise(async (accept, reject) => {
                const dhImportInfo =
                    await httpApiHelper.apiImportInfo(
                        node.state.node_rpc_url,
                        this.state.lastImport.data.dataset_id,
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

    const dv = this.state[whichDV.toLowerCase()];
    const dataSetId = this.state.lastImport.data.dataset_id;

    // Expect DV to have data.
    expect(
        dv.state.purchasedDatasets,
        `Data-set ${dataSetId} was not purchased.`,
    ).to.have.key(dataSetId);

    if (!deepEqual(this.state.lastExport.data.formatted_dataset, this.state.secondLastExport.data.formatted_dataset)) {
        throw Error(`Objects not equal: ${JSON.stringify(this.state.lastExport)} and ${JSON.stringify(this.state.secondLastExport)}`);
    }
});

Given(/^I remember previous import's fingerprint value$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodesWalletAddress !== 'null', 'Nodes wallet should be non null value').to.be.equal(true);

    const { dc } = this.state;

    const myFingerprint =
        await httpApiHelper.apiFingerprint(
            dc.state.node_rpc_url,
            this.state.lastImport.data.dataset_id,
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
            this.state.lastMinusOneImport.data.dataset_id,
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
    expect(this.state.apiQueryLocalResponse[0], 'Response should match dataset_id').to.be.equal(this.state.lastImport.data.dataset_id);
});

Then(/^response hash should match last imported data set id$/, function () {
    expect(!!this.state.apiQueryLocalImportByDataSetIdResponse, 'apiQueryLocalImportByDataSetId should have given some result').to.be.equal(true);

    // TODO not sure if we should check for edges and vertices in apiQueryLocalImportByDataSetIdResponse
    // TODO check that lastImport.dataset_id and sha256 calculated hash are matching

    const calculatedImportHash = ImportUtilities.calculateGraphPublicHash(this.state.apiQueryLocalImportByDataSetIdResponse);
    expect(this.state.lastImport.data.dataset_id, 'Hashes should match').to.be.equal(calculatedImportHash);
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
                commandExecutorVerboseLoggingEnabled: true,
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

Then(/^Answer for the last network query by ([DV|DV2]+) should be empty$/, { timeout: 90000 }, function (whichDV) {
    expect(this.state.lastQueryNetworkId, 'Query not published yet.').to.not.be.undefined;

    const queryId = this.state.lastQueryNetworkId;
    expect(!this.state.dataLocationQueriesConfirmations);
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
            const body = await httpApiHelper.apiGetDatasetInfo(node.state.node_rpc_url, this.state[whichImport].data.dataset_id);
            if (body.dataset_id === this.state[whichImport].data.dataset_id && dv.state.identity !== node.state.identity) {
                nodeCandidates.push(node.state.identity);
            }
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
                dv.nodeConfirmsForDataSetId(queryId, this.state[whichImport].data.dataset_id);
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
    this.logger.log('DC waits for replication window to close');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplicationHandler, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;

    dc.once('replication-window-closed', () => {
        done();
    });
});

Given(/^DC waits for last offer to get written to blockchain$/, { timeout: 180000 }, function (done) {
    this.logger.log('DC waits for last offer to get written to blockchain');
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastReplicationHandler, 'Nothing was replicated. Use other step to do it.').to.be.equal(true);
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

Given(/^I override configuration using variables for all nodes*$/, { timeout: 120000 }, function (configuration, done) {
    const configurationOverride = configuration.raw();
    for (const node of this.state.nodes) {
        node.overrideConfigurationVariables(configurationOverride);
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
    this.logger.log('Selected DHes should be payed out');
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
                    const c = new BN(node.state.calculatedOfferPrice);
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

Given(/^DHs should be payed out for all offers*$/, { timeout: 360000 }, function (done) {
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);

    const promises = [];
    this.state.nodes.slice(1).forEach((node) => {
        promises.push(new Promise((acc) => {
            node.once(`dh-pay-out-offer-${this.state.lastReplication}-completed`, () => {
                acc();
            });
        }));
        promises.push(new Promise((acc) => {
            node.once(`dh-pay-out-offer-${this.state.secondLastReplication}-completed`, () => {
                acc();
            });
        }));
    });

    Promise.all(promises).then(() => {
        done();
    });
});

Then(/^DC should return identity for element id: "(\S+)"$/, async function (elementId) {
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;

    const response = await httpApiHelper.apiGetElementIssuerIdentity(host, elementId);
    expect(response[0], 'Should have key called events').to.have.all.keys('identifierType', 'identifierValue', 'validationSchema');
});
