const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const ImportUtilities = require('../../modules/ImportUtilities');
const sample_data = require('./test_data/otjson-graph');
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

describe('Import utilities module ', () => {
    const web3 = new Web3();
    web3.setProvider(new web3.providers.HttpProvider());

    before('Prepare encryption keys', () => {
        keyPair = Encryption.generateKeyPair();
    });

    it('Sorted stringify', () => {
        const object1 = {
            a: 1,
            b: 'abc',
            c: { d: [1, 2, 3, { e: null, x: undefined }, { y: 1, f: 2 }] },
        };

        const object2 = {
            c: { d: [1, { f: 2, y: 1 }, 2, { x: undefined, e: null }, 3] },
            b: 'abc',
            a: 1,
        };

        const stringifiedObject1 = Utilities.sortedStringify(object1, true);
        const stringifiedObject2 = Utilities.sortedStringify(object2, true);
        assert.equal(stringifiedObject1, stringifiedObject2);
    });

    it('Sorted dataset', () => {
        const sortedOriginal = ImportUtilities.sortStringifyDataset(sample_data.graph);
        const sortedShuffled = ImportUtilities.sortStringifyDataset(sample_data.shuffledGraph);

        assert.equal(sortedOriginal, sortedShuffled);
    });

    it('Encrypt dataset', () => {
        const encryptedGraph =
            ImportUtilities.encryptDataset(sample_data.graph, keyPair.privateKey);

        for (let i = 0; i < encryptedGraph['@graph'].length; i += 1) {
            const originalItem = sample_data.graph['@graph'][i];
            const encryptedItem = encryptedGraph['@graph'][i];

            assert.equal(typeof encryptedItem.properties, 'string');
            const decryptedItem = Utilities.copyObject(encryptedItem);
            decryptedItem.properties = Encryption.decryptObject(
                encryptedItem.properties,
                keyPair.publicKey,
            );

            if (decryptedItem.relations != null) {
                // eslint-disable-next-line no-loop-func
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
        const encryptedGraph =
            ImportUtilities.encryptDataset(sample_data.graph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const stringifiedOriginal = Utilities.sortedStringify(sample_data.graph);
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
        const encryptedGraph =
            ImportUtilities.encryptDataset(sample_data.graph, keyPair.privateKey);
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
                        const decryptedData = sample_data.graph['@graph'].find(el => el['@id'] === objectId)
                            .relations.find(el =>
                                sha3_256(Utilities.stringify(el, 0)) === relationId).properties;
                        const encryptedData =
                            Encryption.encryptObject(decryptedData, keyPair.privateKey);
                        assert.equal(mapData, encryptedData);
                    }
                }
            }
        }
    });

    it('Calculate graph hash', () => {
        const encryptedGraph =
            ImportUtilities.encryptDataset(sample_data.graph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const originalGraphHash = ImportUtilities.calculateGraphHash(sample_data.graph['@graph']);
        const decryptedGraphHash = ImportUtilities.calculateGraphHash(decryptedGraph['@graph']);

        assert.equal(originalGraphHash, decryptedGraphHash);
    });

    it('Calculate dataset root hash', () => {
        const encryptedGraph =
            ImportUtilities.encryptDataset(sample_data.graph, keyPair.privateKey);
        const decryptedGraph = ImportUtilities.decryptDataset(
            encryptedGraph,
            keyPair.publicKey,
        ).decryptedDataset;

        const originalRootHash = ImportUtilities.calculateDatasetRootHash(sample_data.graph['@graph'], sample_data.graph['@id'], sample_data.graph.datasetHeader.dataCreator);
        const decryptedRootHash = ImportUtilities.calculateDatasetRootHash(decryptedGraph['@graph'], decryptedGraph['@id'], decryptedGraph.datasetHeader.dataCreator);

        assert.equal(originalRootHash, decryptedRootHash);
    });

    it('Sign dataset', () => {
        const testGraphCopy = Object.assign({}, sample_data.graph);
        const shuffledGraphCopy = Object.assign({}, sample_data.shuffledGraph);
        const signedOriginal = ImportUtilities.signDataset(testGraphCopy, config, web3);

        const signedShuffled = ImportUtilities.signDataset(shuffledGraphCopy, config, web3);

        assert(signedOriginal.signature != null);
        assert(signedShuffled.signature != null);

        assert.equal(
            ImportUtilities
                .sortStringifyDataset(signedOriginal),
            ImportUtilities
                .sortStringifyDataset(signedShuffled),
        );
    });

    it('Calculate the root hash on one permissioned data object', () => {
        const originalObject = Utilities.copyObject(sample_data.permissioned_data_object);
        const shuffledObject = Utilities.copyObject(sample_data.permissioned_data_object_shuffled);
        const differentObject = Utilities.copyObject(sample_data.permissioned_data_object_2);

        const originalRootHash = ImportUtilities.calculatePermissionedDataHash(originalObject);
        const shuffledRootHash = ImportUtilities.calculatePermissionedDataHash(shuffledObject);
        const differentRootHash = ImportUtilities.calculatePermissionedDataHash(differentObject);

        assert(originalRootHash != null);
        assert(shuffledRootHash != null);
        assert(differentRootHash != null);

        // Hashes should be 32 Bytes (64 characters) with 0x preceding the hash, so 66 characters
        assert(typeof originalRootHash === 'string');
        assert(typeof shuffledRootHash === 'string');
        assert(typeof differentRootHash === 'string');

        assert(originalRootHash.length === 66);
        assert(shuffledRootHash.length === 66);
        assert(differentRootHash.length === 66);

        assert.equal(
            originalRootHash,
            shuffledRootHash,
            'Permissioned data root hash for same object with attributes in different order!',
        );

        assert.notEqual(
            originalRootHash,
            differentRootHash,
            'Permisssioned data root hash for different objects is the same!',
        );
    });

    it('Calculating the root hash of an empty permissioned data object should throw an error', () => {
        const testObject = {};

        let errorHappened = false;
        try {
            ImportUtilities.calculatePermissionedDataHash(testObject);
        } catch (e) {
            errorHappened = true;
            assert.equal(
                e.message,
                'Cannot calculate root hash of an empty object',
                'Unexpected error received',
            );
        }

        assert(errorHappened, 'calculatePermissionedDataHash did not throw an error!');
    });

    it('Calculate the public root hash of one graph', () => {
        const originalGraph = Utilities.copyObject(sample_data.permissioned_data_graph['@graph']);
        ImportUtilities.calculateGraphPermissionedDataHashes(originalGraph);

        const shuffledGraph = Utilities.copyObject(sample_data.permissioned_data_graph_shuffled['@graph']);
        ImportUtilities.calculateGraphPermissionedDataHashes(shuffledGraph);

        const differentGraph = Utilities.copyObject(sample_data.permissioned_data_graph_2['@graph']);
        ImportUtilities.calculateGraphPermissionedDataHashes(differentGraph);

        const originalGraphRootHash = ImportUtilities.calculateGraphPublicHash(originalGraph);
        const shuffledGraphRootHash = ImportUtilities.calculateGraphPublicHash(shuffledGraph);
        const differentGraphRootHash = ImportUtilities.calculateGraphPublicHash(differentGraph);

        assert(originalGraphRootHash != null);
        assert(shuffledGraphRootHash != null);
        assert(differentGraphRootHash != null);

        // Hashes should be 32 Bytes (64 characters) with 0x preceding the hash, so 66 characters
        assert(typeof originalGraphRootHash === 'string');
        assert(typeof shuffledGraphRootHash === 'string');
        assert(typeof differentGraphRootHash === 'string');

        assert(originalGraphRootHash.length === 66);
        assert(shuffledGraphRootHash.length === 66);
        assert(differentGraphRootHash.length === 66);

        assert.equal(
            originalGraphRootHash,
            shuffledGraphRootHash,
            'Graph root hash for same object with attributes in different order!',
        );

        assert.notEqual(
            originalGraphRootHash,
            differentGraphRootHash,
            'Graph root hash for different objects is the same!',
        );
    });

    it('Verify dataset signature', async () => {
        const testGraphCopy = Object.assign({}, sample_data.graph);
        const shuffledGraphCopy = Object.assign({}, sample_data.shuffledGraph);

        const signedOriginal = ImportUtilities.signDataset(testGraphCopy, config, web3);
        const signedShuffled = ImportUtilities.signDataset(shuffledGraphCopy, config, web3);

        assert.equal(
            ImportUtilities
                .sortStringifyDataset(signedOriginal),
            ImportUtilities.sortStringifyDataset(signedShuffled),
        );

        const signerOfOriginal = await ImportUtilities.extractDatasetSigner(signedOriginal, web3);
        const signerOfShuffled = await ImportUtilities.extractDatasetSigner(signedShuffled, web3);

        assert.equal(signerOfOriginal, signerOfShuffled);
        assert.equal(signerOfShuffled, signingWallet.wallet);
    });

    it('Encoding verification', () => {
        const permissionedObject = {
            data: {
                'urn:ot:object:product:batch:humidity': '19.7',
                'urn:ot:object:product:batch:power_feeding': '85',
                'urn:ot:object:product:batch:productId': 'urn:ot:object:actor:id:KakaxiSN687',
                'urn:ot:object:product:batch:rainfall': '0.0',
                'urn:ot:object:product:batch:solar_radiation': '0.0',
                'urn:ot:object:product:batch:temperature': '22.0',
                vocabularyType: 'urn:ot:object:batch',
            },
        };

        const {
            permissioned_data_original_length, permissioned_data_array_length, key,
            encoded_data, permissioned_data_root_hash, encoded_data_root_hash,
        } = ImportUtilities.encodePermissionedData(permissionedObject);

        const result = ImportUtilities.validateAndDecodePermissionedData(
            encoded_data,
            key,
            permissioned_data_array_length,
            permissioned_data_original_length,
        );

        assert.equal(
            Utilities.sortedStringify(permissionedObject.data),
            Utilities.sortedStringify(result.permissionedData),
        );
    });
});
