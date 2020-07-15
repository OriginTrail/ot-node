/* eslint-disable no-unused-expressions, max-len, no-await-in-loop */

const {
    Then, Given,
} = require('cucumber');
const { expect } = require('chai');

const httpApiHelper = require('./lib/http-api-helper');
const utilities = require('./lib/utilities');
const ImportUtilities = require('../../../modules/ImportUtilities');
const Utilities = require('../../../modules/Utilities');
const ZK = require('../../../modules/ZK');
const logger = require('../../../modules/logger');
const MerkleTree = require('../../../modules/Merkle');
const constants = require('../../../modules/constants');
const fs = require('fs');


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

        const calculatedImportHash = ImportUtilities.calculateGraphPublicHash(dataset);
        expect(calculatedImportHash, 'Calculated hashes are different').to.be.equal(myDataSetId);

        const dataCreator = {
            identifiers: [
                {
                    identifierValue: ImportUtilities.getDataCreator(dataset.datasetHeader),
                    identifierType: 'ERC725',
                    validationSchema: '/schemas/erc725-main',
                },
            ],
        };
        const myMerkle = ImportUtilities.calculateDatasetRootHash(dataset);

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

Given(
    /^I call (extended\s|narrow\s|)traversal from "(\S+)" "(\S+)" with connection types "(\S+)"/,
    { timeout: 120000 },
    async function (reach, id_type, id_value, connectionTypes) {
        expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
        const { dc } = this.state;

        const host = dc.state.node_rpc_url;
        const trailParams = {
            identifier_types: [id_type],
            identifier_values: [id_value],
            connection_types: connectionTypes.split(','),
            depth: 50,
        };

        if (reach.includes(constants.TRAIL_REACH_PARAMETERS.narrow)) {
            trailParams.reach = constants.TRAIL_REACH_PARAMETERS.narrow;
        } else if (reach.includes(constants.TRAIL_REACH_PARAMETERS.extended)) {
            trailParams.reach = constants.TRAIL_REACH_PARAMETERS.extended;
        }

        const trail = await httpApiHelper.apiTrail(host, trailParams);

        if (this.state.lastTrail) {
            this.state.secondLastTrail = this.state.lastTrail;
        }
        this.state.lastTrail = trail;
    },
);

Then(
    /^the custom traversal from "(\S+)" "(\S+)" with connection types "(\S+)" should contain (\d+) objects/,
    { timeout: 120000 },
    async function (idType, id, connectionTypes, expectedNumberOfObjects) {
        expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
        const { dc } = this.state;

        const host = dc.state.node_rpc_url;
        const trailParams = {
            identifier_types: [idType],
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

Then(/^zk check should pass/, { timeout: 120000 }, function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    const { dc } = this.state;


    const transformationEvent = this.state.lastTrail.find(x => x.otObject.properties.transformationID === 'BOM12345PO987');

    const params = [{ enc: '16cafc73e9e5a1c15f2982c572e45b444feaf9b41447241', r: '2588f56ba7da' },
        { enc: '1433f36cb15be0228fbac077b8cd020e373b0050fca601c', r: '7ad6c63383f' },
        { enc: 'cb6fc2ced36d5c7c8edbb5b1fe4f9cc0439549d95f4074', r: '1eef0ee83632' },
        { enc: '150f1ac43b69118201c6f9a429d308bfc4e7d8560ba444d', r: '22fe928695c9' }];

    const e = '8b697fe0e';
    const a = '14d7a652dd2d55af08817556ab785b959ca7782d82420ff';
    const zp = '34f8573ca16512a6c1736ac5f3b4f9d5c68b9ff3683583';

    const inputList = [];
    const outputList = [];
    let i;
    for (i = 0; i < transformationEvent.otObject.properties.inputEPCList.epc.length; i += 1) {
        inputList.push({
            object: transformationEvent.otObject.properties.inputEPCList.epc[i],
            public: {
                enc: params[i].enc,
            },
            private: {
                object: transformationEvent.otObject.properties.inputEPCList.epc[i],
                r: params[i].r,
                quantity: Number(transformationEvent.otObject.properties.inputQuantityList.quantityElement[i].quantity),
            },
        });
    }

    for (let j = 0; j < transformationEvent.otObject.properties.outputEPCList.epc.length; j += 1) {
        outputList.push({
            object: transformationEvent.otObject.properties.outputEPCList.epc[j],
            public: {
                enc: params[i + j].enc,
            },
            private: {
                object: transformationEvent.otObject.properties.outputEPCList.epc[j],
                r: params[i + j].r,
                quantity: Number(transformationEvent.otObject.properties.outputQuantityList.quantityElement[j].quantity),
            },
        });
    }

    const zk = new ZK({ logger });

    const inQuantities = inputList.map(o => o.public.enc).sort();
    const outQuantities = outputList.map(o => o.public.enc).sort();

    const z = zk.calculateZero(inQuantities, outQuantities);

    const valid = zk.V(
        e, a, z,
        zp,
    );

    expect(valid, 'Zero Knowledge passed').to.be.equal(true);
});

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

Then(
    /^the last traversal should contain (\d+) objects in total/,
    async function (expectedNumberOfObjects) {
        expect(!!this.state.lastTrail, 'Last traversal not defined. Use other step to define it.').to.be.equal(true);
        const { lastTrail } = this.state;

        expect(
            lastTrail.length,
            `Traversal should contain ${expectedNumberOfObjects} objects`,
        ).to.be.equal(expectedNumberOfObjects);
    },
);

Then(
    'Corrupted node should not have last replication dataset',
    async function () {
        expect(!!this.state.corruptedNode, 'Corrupted node not defined. Use other step to define it.').to.be.equal(true);

        const erc725 = JSON.parse(fs.readFileSync(`${this.state.corruptedNode.options.configDir}/${this.state.corruptedNode.options.nodeConfiguration.erc725_identity_filepath}`).toString());
        expect(
            erc725.identity.toUpperCase(),
            'Declined identity should be the one that db was corrupted.',
        ).to.be.equal(this.state.dc.state.declinedDhIdentity.toUpperCase());
    },
);

Then(/^I calculate and validate the proof of the last traversal/, { timeout: 120000 }, async function () {
    expect(!!this.state.dc, 'DC node not defined. Use other step to define it.').to.be.equal(true);
    expect(!!this.state.lastTrail, 'Last traversal not defined. Use other step to define it.').to.be.equal(true);
    const { dc } = this.state;
    const host = dc.state.node_rpc_url;
    const { lastTrail } = this.state;

    const datasetObjectMap = {};
    for (const trailElement of lastTrail) {
        const { otObject } = trailElement;

        for (const dataset of trailElement.datasets) {
            if (datasetObjectMap[dataset] != null) {
                datasetObjectMap[dataset].push(otObject['@id']);
            } else {
                datasetObjectMap[dataset] = [otObject['@id']];
            }
        }
    }

    for (const dataset of Object.keys(datasetObjectMap)) {
        const proofResponse = await httpApiHelper.apiMerkleProofs(host, {
            dataset_id: dataset,
            object_ids: datasetObjectMap[dataset],
        });

        for (const proofData of proofResponse) {
            const { proof, object_index, otObject } = proofData;
            const objectText = JSON.stringify(otObject);

            const merkleTree = new MerkleTree(['1', '1', '1', '1', '1', '1', '1', '1', '1', '1'], 'distribution', 'sha3');
            const rootHash = merkleTree.calculateProofResult(proof, objectText, object_index);

            const myFingerprint = await httpApiHelper.apiFingerprint(host, dataset);
            expect(`0x${rootHash}`).to.be.equal(myFingerprint.root_hash);
        }
    }
});
