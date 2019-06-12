const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const ImportUtilities = require('../../modules/ImportUtilities');
const testGraph = require('./test_data/otjson-graph');
const Encryption = require('./../../modules/Encryption');
const Utilities = require('./../../modules/Utilities');

let keyPair = {};

describe('Encryption modules ', () => {
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

        const stringifiedObject1 = ImportUtilities.sortedStringify(object1);
        const stringifiedObject2 = ImportUtilities.sortedStringify(object2);
        assert.equal(stringifiedObject1, stringifiedObject2);
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

            const stringifiedOriginal = ImportUtilities.sortedStringify(originalItem);
            const stringifiedDecrypted = ImportUtilities.sortedStringify(decryptedItem);

            assert.equal(stringifiedOriginal, stringifiedDecrypted);
        }
    });

    it('Decrypt dataset', () => {
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const stringifiedOriginal = ImportUtilities.sortedStringify(testGraph);
        const stringifiedDecrypted = ImportUtilities.sortedStringify(decryptedGraph);

        assert.equal(stringifiedOriginal, stringifiedDecrypted);
    });

    it('Decrypted dataset encryption map', () => {
        const colorMap = {
            0: 'red',
            1: 'green',
            2: 'blue',
        };

        const encryptionColor = 'red';
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);
        const { encryptedMap } = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
            colorMap[encryptionColor],
        );

        for (const objectId of Object.keys(encryptedMap)) {
            const mapData = encryptedMap[objectId][encryptionColor];
            const encryptedData = encryptedGraph['@graph'].find(el => el['@id'] === objectId).properties;
            assert.equal(mapData, encryptedData);
        }
    });

    it('Calculate graph hash', () => {
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const originalGraphHash = ImportUtilities.calculateGraphHash(encryptedGraph['@graph']);
        const decryptedGraphHash = ImportUtilities.calculateGraphHash(encryptedGraph['@graph']);

        assert.equal(originalGraphHash, decryptedGraphHash);
    });

    it('Calculate dataset root hash', () => {
        const encryptedGraph = ImportUtilities.encryptDataset(testGraph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const originalRootHash = ImportUtilities.calculateDatasetRootHash(encryptedGraph);
        const decryptedRootHash = ImportUtilities.calculateDatasetRootHash(decryptedGraph);

        assert.equal(originalRootHash, decryptedRootHash);
    });
});
