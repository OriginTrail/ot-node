/* eslint-disable no-unused-expressions, max-len, no-await-in-loop */

const {
    Then,
} = require('cucumber');
const { expect } = require('chai');

const httpApiHelper = require('./lib/http-api-helper');
const utilities = require('./lib/utilities');
const ImportUtilities = require('../../../modules/ImportUtilities');


Then(/^imported data is compliant with 01_Green_to_pink_shipment.xml file$/, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(this.state.nodes.length, 'No started nodes').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes').to.be.greaterThan(0);
    expect(!!this.state.lastImport, 'Last import didn\'t happen. Use other step to do it.').to.be.equal(true);

    const { dc } = this.state;
    let data;
    const myApiImportInfo = await httpApiHelper.apiImportInfo(dc.state.node_rpc_url, this.state.lastImport.data_set_id);

    expect(
        utilities.findVertexIdValue(myApiImportInfo.import.vertices, 'IDENTIFIER', 'urn:ot:object:actor:id:Company_Green', 'uid', 'urn:ot:object:actor:id:Company_Green:2018-01-01T01:00:00.000-04:00Z-04:00').length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    data = {
        parent_id: 'urn:epc:id:sgln:Building_Green',
    };
    expect(
        utilities.findVertexUid(myApiImportInfo.import.vertices, 'LOCATION', 'urn:ot:object:actor:id:Company_Green', 'urn:epc:id:sgln:Building_Green_V2', data).length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    data = {
        category: 'Company',
        name: 'Green',
        object_class_id: 'Actor',
        wallet: '0xBbAaAd7BD40602B78C0649032D2532dEFa23A4C0',
    };
    expect(
        utilities.findVertexUid(myApiImportInfo.import.vertices, 'ACTOR', 'urn:ot:object:actor:id:Company_Green', 'urn:ot:object:actor:id:Company_Green', data).length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    data = {
        category: 'Beverage',
        description: 'Wine Bottle',
        object_class_id: 'Product',
    };
    expect(
        utilities.findVertexUid(myApiImportInfo.import.vertices, 'PRODUCT', 'urn:ot:object:actor:id:Company_Green', 'urn:ot:object:product:id:Product_1', data).length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    data = {
        expirationDate: '2020-31-12T00:01:54Z',
        parent_id: 'urn:ot:object:product:id:Product_1',
        productId: 'urn:ot:object:product:id:Product_1',
        productionDate: '2017-31-12T00:01:54Z',
        quantities: {
            'urn:ot:object:actor:id:Company_Green:2018-01-01T01:00:00.000-04:00Z-04:00': {
                PCS: '5d3381241af6b16260f680059e9042',
            },
        },
    };
    expect(
        utilities.findVertexUid(myApiImportInfo.import.vertices, 'BATCH', 'urn:ot:object:actor:id:Company_Green', 'urn:epc:id:sgtin:Batch_1', data).length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    expect(
        utilities.findVertexIdValue(myApiImportInfo.import.vertices, 'IDENTIFIER', 'urn:ot:object:actor:id:Company_Green', 'uid', 'urn:epc:id:sgln:Building_Green').length,
        'There should be at least one such vertex',
    ).to.be.above(0);
});

Then(/^DC manually calculated (\d+) datasets data and root hashes matches ones from blockchain$/, async function (datasetsCount) {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(datasetsCount >= 1, 'Positive integer').to.be.true;

    const { dc } = this.state;
    const myApiImportsInfo = await httpApiHelper.apiImportsInfo(dc.state.node_rpc_url);
    expect(myApiImportsInfo.length, 'We should have preciselly this many datasets').to.be.equal(datasetsCount);

    for (const i in Array.from({ length: myApiImportsInfo.length })) {
        const myDataSetId = myApiImportsInfo[i].data_set_id;
        const myFingerprint = await httpApiHelper.apiFingerprint(dc.state.node_rpc_url, myDataSetId);
        expect(utilities.isZeroHash(myFingerprint.root_hash), 'root hash value should not be zero hash').to.be.equal(false);


        const myEdgesVertices = await httpApiHelper.apiQueryLocalImportByDataSetId(dc.state.node_rpc_url, myDataSetId);
        expect(myEdgesVertices, 'Should have corresponding keys').to.have.keys(['edges', 'vertices']);

        const calculatedImportHash = utilities.calculateImportHash(myEdgesVertices);
        expect(calculatedImportHash, 'Calculated hashes are different').to.be.equal(myDataSetId);

        // vertices and edges are already sorted from the response
        const myMerkle = await ImportUtilities.merkleStructure(myEdgesVertices.vertices.filter(vertex =>
            vertex.vertex_type !== 'CLASS'), myEdgesVertices.edges);

        expect(myFingerprint.root_hash, 'Fingerprint from API endpoint and manually calculated should match').to.be.equal(myMerkle.tree.getRoot());
    }
});

Then(/^([DC|DV]+)'s local query response should contain hashed private attributes$/, async function (nodeType) {
    expect(nodeType, 'Node type can only be DC or DV.').to.satisfy(val => (val === 'DC' || val === 'DV'));
    expect(!!this.state[nodeType.toLowerCase()], 'DC/DV node not defined. Use other step to define it.').to.be.equal(true);

    expect(!!this.state.apiQueryLocalImportByDataSetIdResponse, 'Query response of last local imported data set id not defined').to.be.equal(true);

    expect(this.state.apiQueryLocalImportByDataSetIdResponse, 'Response should contain two keys').to.have.keys(['edges', 'vertices']);

    this.state.apiQueryLocalImportByDataSetIdResponse.vertices.forEach((vertex) => {
        if (vertex.data) {
            if (vertex.data.private) {
                let sumOfHashesLengths = 0;
                let randomHashLength;
                Object.keys(vertex.data.private).forEach((key) => {
                    expect((vertex.data.private[key]).startsWith('0x'), 'Private value should start with 0x').to.be.true;
                    expect(utilities.isZeroHash(vertex.data.private[key]), 'Private value should not be empty hash').to.be.false;
                    sumOfHashesLengths += (vertex.data.private[key]).length;
                    randomHashLength = (vertex.data.private[key]).length;
                });
                expect(sumOfHashesLengths % randomHashLength, 'All hashes should be of same length').to.equal(0);
            }
        }
    });
});

