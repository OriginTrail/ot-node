const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const ImportUtilities = require('../../modules/ImportUtilities');
const { graph: testGraph, shuffledGraph, graph2: testGraph2 } = require('./test_data/otjson-graph');
const Encryption = require('./../../modules/Encryption');
const Utilities = require('./../../modules/Utilities');
const Web3 = require('web3');
const { sha3_256 } = require('js-sha3');

let keyPair = {};
const signingWallet = {
    wallet: '0x324b939670d154667466b17524d9136d879CDC09',
    privateKey: '1556ba8faf6c2a1e696e4a70a0b7e1c6582ba26b9d8e6a9a7b96b22a29a5d2d3',
};

const config = {
    node_private_key: signingWallet.privateKey,
};

describe('Encryption modules ', () => {
    const web3 = new Web3();
    web3.setProvider(new web3.providers.HttpProvider());

    before('Prepare encryption keys', () => {
        keyPair = Encryption.generateKeyPair();
    });

    it('Sorted stringify', () => {
        const object1 = {
            a: 1,
            b: 'abc',
            c: { d: [1, 2, 3, { e: null, x: undefined }] },
        };

        const object2 = { c: { d: [1, 2, 3, { x: undefined, e: null }] }, b: 'abc', a: 1 };

        const stringifiedObject1 = Utilities.sortedStringify(object1);
        const stringifiedObject2 = Utilities.sortedStringify(object2);
        assert.equal(stringifiedObject1, stringifiedObject2);
    });

    it('Sorted dataset', () => {
        const sortedOriginal = ImportUtilities.sortDataset(testGraph);
        const sortedShuffled = ImportUtilities.sortDataset(shuffledGraph);

        assert.equal(sortedOriginal, sortedShuffled);
    });

    it('Encrypt dataset', () => {
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);

        for (let i = 0; i < encryptedGraph['@graph'].length; i += 1) {
            const originalItem = testGraph['@graph'][i];
            const encryptedItem = encryptedGraph['@graph'][i];

            assert.equal(typeof encryptedItem.properties, 'string');
            const decryptedItem = Utilities.copyObject(encryptedItem);
            decryptedItem.properties = Encryption.decryptObject(
                encryptedItem.properties,
                keyPair.publicKey,
            );

            if (decryptedItem.relations != null) {
                decryptedItem.relations.forEach((relation) => {
                    relation.properties =
                        Encryption.decryptObject(relation.properties, keyPair.publicKey);
                });
            }

            const stringifiedOriginal = Utilities.sortedStringify(originalItem);
            const stringifiedDecrypted = Utilities.sortedStringify(decryptedItem);

            assert.equal(stringifiedOriginal, stringifiedDecrypted);
        }
    });

    it('Decrypt dataset', () => {
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const stringifiedOriginal = Utilities.sortedStringify(testGraph);
        const stringifiedDecrypted = Utilities.sortedStringify(decryptedGraph);

        assert.equal(stringifiedOriginal, stringifiedDecrypted);
    });

    it('Decrypted dataset encryption map', () => {
        const colorMap = {
            red: 0,
            green: 1,
            blue: 2,
        };

        const encryptionColor = 'red';
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);
        const { encryptedMap } = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
            colorMap[encryptionColor],
        );

        for (const type of Object.keys(encryptedMap)) {
            if (type === 'objects') {
                for (const objectId of Object.keys(encryptedMap[type])) {
                    const mapData = encryptedMap[type][objectId][encryptionColor];
                    const encryptedData = encryptedGraph['@graph'].find(el => el['@id'] === objectId).properties;
                    assert.equal(mapData, encryptedData);
                }
            }
            if (type === 'relations') {
                for (const objectId of Object.keys(encryptedMap[type])) {
                    for (const relationId of Object.keys(encryptedMap[type][objectId])) {
                        const mapData = encryptedMap[type][objectId][relationId][encryptionColor];
                        const decryptedData = testGraph['@graph'].find(el => el['@id'] === objectId)
                            .relations.find(el => sha3_256(Utilities.stringify(el, 0)) === relationId).properties;
                        const encryptedData = Encryption.encryptObject(decryptedData, keyPair.privateKey)
                        assert.equal(mapData, encryptedData);
                    }
                }
            }
        }
    });

    it('Calculate graph hash', () => {
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const originalGraphHash = ImportUtilities.calculateGraphHash(testGraph['@graph']);
        const decryptedGraphHash = ImportUtilities.calculateGraphHash(decryptedGraph['@graph']);

        assert.equal(originalGraphHash, decryptedGraphHash);
    });

    it('Calculate dataset root hash', () => {
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const originalRootHash = ImportUtilities.calculateDatasetRootHash(encryptedGraph['@graph'], encryptedGraph['@id'], encryptedGraph.datasetHeader.dataCreator);
        const decryptedRootHash = ImportUtilities.calculateDatasetRootHash(decryptedGraph['@graph'], decryptedGraph['@id'], decryptedGraph.datasetHeader.dataCreator);

        assert.equal(originalRootHash, decryptedRootHash);
    });

    it('Sign dataset', () => {
        const testGraphCopy = Object.assign({}, testGraph);
        const shuffledGraphCopy = Object.assign({}, shuffledGraph);
        const signedOriginal = ImportUtilities.signDataset(testGraphCopy, config, web3);

        const signedShuffled = ImportUtilities.signDataset(shuffledGraphCopy, config, web3);

        assert(signedOriginal.signature != null);
        assert(signedShuffled.signature != null);

        assert.equal(
            ImportUtilities
                .sortDataset(signedOriginal),
            ImportUtilities
                .sortDataset(signedShuffled),
        );
    });

    it('Verify dataset signature', async () => {
        const testGraphCopy = Object.assign({}, testGraph);
        const shuffledGraphCopy = Object.assign({}, shuffledGraph);

        const signedOriginal = ImportUtilities.signDataset(testGraphCopy, config, web3);
        const signedShuffled = ImportUtilities.signDataset(shuffledGraphCopy, config, web3);

        assert.equal(ImportUtilities
            .sortDataset(signedOriginal), ImportUtilities.sortDataset(signedShuffled));

        const signerOfOriginal = await ImportUtilities.extractDatasetSigner(signedOriginal, web3);
        const signerOfShuffled = await ImportUtilities.extractDatasetSigner(signedShuffled, web3);

        assert.equal(signerOfOriginal, signerOfShuffled);
        assert.equal(signerOfShuffled, signingWallet.wallet);
    });
});
