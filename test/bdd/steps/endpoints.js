/* eslint-disable no-unused-expressions, max-len */

const {
    Then, Given,
} = require('cucumber');
const BN = require('bn.js');
const { expect } = require('chai');
const fs  = require('fs');

const httpApiHelper = require('./lib/http-api-helper');

Given(/^DC imports "([^"]*)" as ([GS1\-EPCIS|GRAPH|OT\-JSON|WOT]+)$/, { timeout: 20000 }, async function (importFilePath, importType) {
    expect(importType, 'importType can only be GS1-EPCIS or GRAPH.').to.satisfy(val => (val === 'GS1-EPCIS' || val === 'GRAPH' || val === 'OT-JSON' || val === 'WOT'));
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;

    const importResponse = await httpApiHelper.apiImport(host, importFilePath, importType);

    expect(importResponse).to.have.keys(['handler_id']);

    // sometimes there is a need to remember import before the last one
    if (this.state.lastImportHandler) {
        this.state.secondLastImportHandler = this.state.lastImportHandler;
    }
    this.state.lastImportHandler = importResponse.handler_id;
});


Then(/^DC checks status of the last import$/, { timeout: 1200000 }, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;

    this.state.lastImportStatus = await httpApiHelper.apiImportResult(host, this.state.lastImportHandler);
});

Then(/^The last import status should be "([^"]*)"$/, { timeout: 1200000 }, async function (status) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(this.state.lastImportStatus.status).to.be.equal(status);
});

Given(/^DC waits for import to finish$/, { timeout: 1200000 }, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;

    const promise = new Promise((acc) => {
        dc.once('import-complete', async () => {
            if (this.state.lastImport) {
                this.state.secondLastImport = this.state.lastImport;
            }

            this.state.lastImport = await httpApiHelper.apiImportResult(host, this.state.lastImportHandler);
            acc();
        });
    });

    return promise;
});

Given(/^DC exports the last imported dataset as ([GS1\-EPCIS|GRAPH|OT\-JSON|WOT]+)$/, async function (exportType) {
    expect(exportType, 'export type can only be GS1-EPCIS, OT-JSON, or GRAPH.').to.satisfy(val => (val === 'GS1-EPCIS' || val === 'GRAPH' || val === 'OT-JSON' || val === 'WOT'));
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Last import data not defined. Use other step to define it.').to.be.equal(true);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;
    const { dataset_id } = this.state.lastImport.data;

    const exportResponse = await httpApiHelper.apiExport(host, dataset_id, exportType);

    expect(exportResponse).to.have.keys(['handler_id']);

    // sometimes there is a need to remember export before the last one
    if (this.state.lastExportHandler) {
        this.state.secondLastExportHandler = this.state.lastExportHandler;
    }
    this.state.lastExportHandler = exportResponse.handler_id;
    this.state.lastExportType = exportType;
});

Given(/^DC waits for export to finish$/, { timeout: 1200000 }, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;

    const promise = new Promise((acc) => {
        dc.once('export-complete', async () => {
            if (this.state.lastExport) {
                this.state.secondLastExport = this.state.lastExport;
            }

            this.state.lastExport = await httpApiHelper.apiExportResult(host, this.state.lastExportHandler);
            acc();
        });
    });

    return promise;
});

Given(/^response should return same dataset_ids as second last import and last import$/, async function () {
    expect(!!this.state.lastImportHandler, 'Last imports handler_id not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.secondLastImportHandler, 'Second last imports handler_id not defined. Use other step to define it.').to.be.equal(true);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;

    const response = await httpApiHelper.apiQueryLocal(host, this.state.jsonQuery);
    this.state.apiQueryLocalResponse = response;
    const importIds = [this.state.secondLastImport.data.dataset_id, this.state.lastImport.data.dataset_id];
    // TODO fix message
    expect(response.filter(val => importIds.includes(val) !== false).length, 'Response not good.').to.be.equal(2);
});


Given(/^DC initiates the replication for last imported dataset$/, { timeout: 60000 }, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;

    let response;
    try {
        response =
            await httpApiHelper.apiReplication(
                host,
                this.state.lastImport.data.dataset_id,
            );
        this.state.lastReplicationHandler = response;
    } catch (e) {
        throw Error(`Failed to initiate replicate. Got reply: ${JSON.stringify(response)}`);
    }
});

Given(/^I create json query with path: "(\S+)", value: "(\S+)" and opcode: "(\S+)"$/, async function (path, value, opcode) {
    expect(opcode, 'Opcode should only be EQ or IN.').to.satisfy(val => (val === 'EQ' || val === 'IN'));

    const myJsonQuery = {
        query:
            [
                {
                    path,
                    value,
                    opcode,
                },
            ],
    };

    this.state.jsonQuery = myJsonQuery;
});

Given(/^I append json query with path: "(\S+)", value: "(\S+)" and opcode: "(\S+)"$/, async function (path, value, opcode) {
    expect(opcode, 'Opcode should only be EQ or IN.').to.satisfy(val => (val === 'EQ' || val === 'IN'));
    expect(!!this.state.jsonQuery, 'json query must exist').to.be.equal(true);

    const myAppendQueryObject = {
        path,
        value,
        opcode,
    };

    this.state.jsonQuery.query.push(myAppendQueryObject);
});

Given(/^(DC|DH|DV) node makes local query with previous json query$/, async function (targetNode) {
    expect(targetNode, 'Node type can only be DC, DH or DV.').to.satisfy(val => (val === 'DC' || val === 'DH' || val === 'DV'));
    expect(!!this.state[targetNode.toLowerCase()], 'Target node not defined. Use other step to define it.').to.be.equal(true);


    const host = this.state[targetNode.toLowerCase()].state.node_rpc_url;

    const response = await httpApiHelper.apiQueryLocal(host, this.state.jsonQuery);
    if (this.state.apiQueryLocalResponse) {
        this.state.apiLastQueryLocalResponse = this.state.apiQueryLocalResponse;
    }
    this.state.apiQueryLocalResponse = response;
});

Given(/^the last two queries should return the same object$/, async function () {
    expect(this.state.apiQueryLocalResponse[0]).to.be.equal(this.state.apiLastQueryLocalResponse[0]);
});

Given(/^I query ([DC|DH|DV]+) node locally for last imported data set id$/, async function (targetNode) {
    expect(!!this.state.lastImport, 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(!!this.state.lastImport.data.dataset_id, 'Last imports data set id seems not defined').to.be.equal(true);
    expect(targetNode, 'Node type can only be DC, DH or DV.').to.satisfy(val => (val === 'DC' || val === 'DH' || val === 'DV'));
    expect(!!this.state[targetNode.toLowerCase()], 'Target node not defined. Use other step to define it.').to.be.equal(true);

    const host = this.state[targetNode.toLowerCase()].state.node_rpc_url;
    const lastDataSetId = this.state.lastImport.data.dataset_id;

    const response = await httpApiHelper.apiQueryLocalImportByDataSetId(host, lastDataSetId);
    this.state.apiQueryLocalImportByDataSetIdResponse = response;
});

Given(/^([DV|DV2]+) publishes query consisting of path: "(\S+)", value: "(\S+)" and opcode: "(\S+)" to the network$/, { timeout: 90000 }, async function (whichDV, path, value, opcode) {
    expect(!!this.state[whichDV.toLowerCase()], 'DV/DV2 node not defined. Use other step to define it.').to.be.equal(true);
    expect(opcode, 'Opcode should only be EQ or IN.').to.satisfy(val => (val === 'EQ' || val === 'IN'));
    const dv = this.state[whichDV.toLowerCase()];

    // TODO find way to pass jsonQuery directly to step definition
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
    const queryNetworkResponse =
        await httpApiHelper.apiQueryNetwork(dv.state.node_rpc_url, jsonQuery);
    expect(Object.keys(queryNetworkResponse), 'Response should have message and query_id').to.have.members(['message', 'query_id']);
    expect(queryNetworkResponse.message, 'Message should inform about successful sending of the query').to.be.equal('Query sent successfully.');
    this.state.lastQueryNetworkId = queryNetworkResponse.query_id;
    return new Promise((accept, reject) => dv.once('dv-network-query-processed', () => accept()));
});

Given(/^the ([DV|DV2]+) purchases (last import|second last import) from the last query from (a DH|the DC|a DV)$/, function (whichDV, whichImport, fromWhom, done) {
    expect(whichDV, 'Query can be made either by DV or DV2.').to.satisfy(val => (val === 'DV' || val === 'DV2'));
    expect(whichImport, 'last import or second last import are only allowed values').to.be.oneOf(['last import', 'second last import']);
    whichImport = (whichImport === 'last import') ? 'lastImport' : 'secondLastImport';
    expect(!!this.state[whichDV.toLowerCase()], 'DV/DV2 node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state[whichImport], 'Nothing was imported. Use other step to do it.').to.be.equal(true);
    expect(this.state.lastQueryNetworkId, 'Query not published yet.').to.not.be.undefined;

    const { dc } = this.state;
    const dv = this.state[whichDV.toLowerCase()];
    const queryId = this.state.lastQueryNetworkId;
    const dataSetId = this.state[whichImport].data.dataset_id;
    let sellerNode;

    const confirmationsSoFar =
        dv.nodeConfirmsForDataSetId(queryId, dataSetId);

    expect(confirmationsSoFar).to.have.length.greaterThan(0);

    if (fromWhom === 'a DH') {
        // Find first DH that replicated last import.
        sellerNode = this.state.nodes.find(node => (node !== dc && node !== dv));
    } else if (fromWhom === 'the DC') {
        sellerNode = dc;
    } else if (fromWhom === 'a DV') {
        if (whichDV === 'DV') {
            console.log('DV cant buy from DV');
            process.exit(-1);
        }
        sellerNode = this.state.dv;
    }

    expect(sellerNode, 'Didn\'t find seller node.').to.not.be.undefined;
    const { replyId } =
        dv.state.dataLocationQueriesConfirmations[queryId][sellerNode.state.identity];

    expect(replyId).to.not.be.undefined;

    // Wait for purchase to happened and then exit.
    dv.once('dataset-purchase', (purchase) => {
        if (purchase.queryId === queryId &&
            purchase.replyId === replyId &&
            purchase.dataSetId === dataSetId) {
            this.logger.info(`${dv.state.identity} finished purchase for data-set ID ${dataSetId} from sellerNode ${sellerNode.state.identity}`);
            done();
        }
    });

    // Initiate actual purchase.
    httpApiHelper.apiReadNetwork(dv.state.node_rpc_url, queryId, replyId, dataSetId)
        .catch(error => done(error));
});

Given(/^([DC|DH|DV]+) calls consensus endpoint for sender: "(\S+)"$/, async function (nodeType, senderId) {
    expect(nodeType, 'Node type can only be DC, DH, DV.').to.be.oneOf(['DC', 'DH', 'DV']);

    const host = this.state[nodeType.toLowerCase()].state.node_rpc_url;

    const consensusResponse = await httpApiHelper.apiConsensus(host, senderId);
    expect(consensusResponse, 'Should have key called events').to.have.all.keys('events');
    this.state.lastConsensusResponse = consensusResponse;
});

Given(/^default initial token amount should be deposited on (\d+)[st|nd|rd|th]+ node's profile$/, async function (nodeIndex) {
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);

    const balance = await httpApiHelper.apiBalance(this.state.nodes[nodeIndex - 1].state.node_rpc_url, false);
    const staked = new BN(balance.profile.staked);
    const initialDepositAmount = new BN(this.state.nodes[nodeIndex - 1].options.nodeConfiguration.initial_deposit_amount);

    expect(staked.toString()).to.be.equal(initialDepositAmount.toString());
});


Then(/^DC gets issuer id for element "([^"]*)"$/, { timeout: 120000 }, async function (elementId) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const host = dc.state.node_rpc_url;

    this.state.elementIssuer = await httpApiHelper.apiGetElementIssuerIdentity(host, elementId);
});

Then(/^DC should be the issuer for the selected element$/, { timeout: 120000 }, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);

    const { dc } = this.state;
    const erc725 = JSON.parse(fs.readFileSync(`${dc.options.configDir}/${dc.options.nodeConfiguration.erc725_identity_filepath}`).toString());
    expect(this.state.elementIssuer[0].identifiers[0].identifierValue.toUpperCase()).to.be.equal(erc725.identity.toUpperCase());
});
