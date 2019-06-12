const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const ImportUtilities = require('../../modules/ImportUtilities');
const { graph: testGraph, shuffledGraph, graph2: testGraph2 } = require('./test_data/otjson-graph');
const Encryption = require('./../../modules/Encryption');
const Utilities = require('./../../modules/Utilities');
const Web3 = require('web3');

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

        const stringifiedObject1 = ImportUtilities.sortedStringify(object1);
        const stringifiedObject2 = ImportUtilities.sortedStringify(object2);
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

    it('check that decrypting encrypted dataset gives back original dataset', () => {
        const encryptedDataset = ImportUtilities.encryptDataset(testGraph2, keyPair.privateKey);
        const decryptedDataset = ImportUtilities.decryptDataset(encryptedDataset, keyPair.publicKey, 0);

        console.log(JSON.stringify(encryptedDataset));
        console.log(JSON.stringify(decryptedDataset));
    });
});
