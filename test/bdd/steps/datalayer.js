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
    const myApiImportInfo = await httpApiHelper.apiImportInfo(dc.state.node_rpc_url, this.state.lastImport.data.dataset_id);

    expect(
        utilities.findVertexIdValue(myApiImportInfo.document['@graph'], 'id', 'urn:ot:object:actor:id:Company_Green').length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    data = {
        parent_id: 'urn:epc:id:sgln:Building_Green',
    };
    expect(
        utilities.findVertexUid(myApiImportInfo.document['@graph'], 'urn:epc:id:sgln:Building_Green_V2').length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    data = {
        category: 'Company',
        name: 'Green',
        object_class_id: 'Actor',
        wallet: '0xBbAaAd7BD40602B78C0649032D2532dEFa23A4C0',
    };
    expect(
        utilities.findVertexUid(myApiImportInfo.document['@graph'], 'urn:ot:object:actor:id:Company_Green').length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    data = {
        category: 'Beverage',
        description: 'Wine Bottle',
        object_class_id: 'Product',
    };
    expect(
        utilities.findVertexUid(myApiImportInfo.document['@graph'], 'urn:ot:object:product:id:Product_1', data).length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    data = {
        expirationDate: '2020-31-12T00:01:54Z',
        parent_id: 'urn:ot:object:product:id:Product_1',
        productId: 'urn:ot:object:product:id:Product_1',
        productionDate: '2017-31-12T00:01:54Z',
        quantities: {
            'urn:ot:object:actor:id:Company_Green:2018-01-01T01:00:00.000-04:00Z-04:00': {
                PCS: '11079ead57df77828224b3692c14118b993cb8199cfb5b8',
            },
        },
    };
    expect(
        utilities.findVertexUid(myApiImportInfo.document['@graph'], 'urn:epc:id:sgtin:Batch_1', data).length,
        'There should be at least one such vertex',
    ).to.be.above(0);
    expect(
        utilities.findVertexIdValue(myApiImportInfo.document['@graph'], 'id', 'urn:ot:object:actor:id:Company_Green').length,
        'There should be at least one such vertex',
    ).to.be.above(0);
});

Then(/^(DC|DH)'s (\d+) dataset hashes should match blockchain values$/, async function (nodeType, datasetsCount) {
    expect(nodeType, 'Node type can only be DC or DH').to.be.oneOf(['DC', 'DH']);
    expect(!!this.state[nodeType.toLowerCase()], 'DC/DH node not defined. Use other step to define it.').to.be.equal(true);
    expect(datasetsCount >= 1, 'datasetsCount should be positive integer').to.be.true;

    const myNode = this.state[nodeType.toLowerCase()];
    // const myApiImportsInfo = await httpApiHelper.apiImportResult(myNode.state.node_rpc_url, this.state.lastImportsHandler);
    const myApiImportsInfo = await httpApiHelper.apiImportsInfo(myNode.state.node_rpc_url);

    expect(myApiImportsInfo.length, 'We should have precisely this many datasets').to.be.equal(datasetsCount);

    for (const i in Array.from({ length: myApiImportsInfo.length })) {
        const myDataSetId = myApiImportsInfo[i].data_set_id;
        const myFingerprint = await httpApiHelper.apiFingerprint(myNode.state.node_rpc_url, myDataSetId);
        expect(utilities.isZeroHash(myFingerprint.root_hash), 'root hash value should not be zero hash').to.be.equal(false);

        const dataset = await httpApiHelper.apiQueryLocalImportByDataSetId(myNode.state.node_rpc_url, myDataSetId);

        const calculatedImportHash = ImportUtilities.calculateGraphHash(dataset['@graph']);
        expect(calculatedImportHash, 'Calculated hashes are different').to.be.equal(myDataSetId);

        const dataCreator = {
            identifiers: [
                {
                    identifierValue: dataset.datasetHeader.dataCreator.identifiers[0].identifierValue,
                    identifierType: 'ERC725',
                    validationSchema: '/schemas/erc725-main',
                },
            ],
        };
        const myMerkle = ImportUtilities.calculateDatasetRootHash(dataset['@graph'], dataset['@id'], dataCreator);

        expect(myFingerprint.root_hash, 'Fingerprint from API endpoint and manually calculated should match').to.be.equal(myMerkle);
    }
});

Then(/^([DC|DV]+)'s local query response should contain hashed private attributes$/, async function (nodeType) {
    expect(nodeType, 'Node type can only be DC or DV.').to.satisfy(val => (val === 'DC' || val === 'DV'));
    expect(!!this.state[nodeType.toLowerCase()], 'DC/DV node not defined. Use other step to define it.').to.be.equal(true);

    expect(!!this.state.apiQueryLocalImportByDataSetIdResponse, 'Query response of last local imported data set id not defined').to.be.equal(true);

    // expect(this.state.apiQueryLocalImportByDataSetIdResponse, 'Response should contain two keys').to.have.keys(['edges', 'vertices']);

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

Then(
    /^the traversal from id "(\S+)" with connection types "(\S+)" should contain (\d+) objects/,
    { timeout: 120000 },
    async function (id, connectionTypes, expectedNumberOfObjects) {
        expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
        const { dc } = this.state;

        const host = dc.state.node_rpc_url;
        const trailParams = {
            identifier_types: ['id'],
            identifier_values: [id],
            connection_types: connectionTypes.split(','),
            depth: 10,
        };

        const trail = await httpApiHelper.apiTrail(host, trailParams);

        expect(trail, 'should not be null').to.not.be.undefined;
        expect(trail, 'should be an Array').to.be.an.instanceof(Array);
        expect(
            trail.length,
            `Traversal result should contain ${expectedNumberOfObjects} object(s)`,
        ).to.be.equal(expectedNumberOfObjects);

        this.state.lastTrail = trail;
    },
);

Then(
    /^the last traversal should contain (\d+) objects with type "(\S+)" and value "(\S+)"/,
    async function (expectedNumberOfObjects, keySequenceString, value) {
        expect(!!this.state.lastTrail, 'Last traversal not defined. Use other step to define it.').to.be.equal(true);
        const { lastTrail } = this.state;

        const keySequenceArray = keySequenceString.split('.');

        const filteredTrail = lastTrail.filter((trailElement) => {
            let property = trailElement;
            for (const key of keySequenceArray) {
                if (!property[key]) {
                    return false;
                }
                property = property[key];
            }
            return property === value;
        });

        expect(filteredTrail, 'should be an Array').to.be.an.instanceof(Array);
        expect(
            filteredTrail.length,
            `Traversal should contain ${expectedNumberOfObjects} of selected objects`,
        ).to.be.equal(expectedNumberOfObjects);
    },
);
