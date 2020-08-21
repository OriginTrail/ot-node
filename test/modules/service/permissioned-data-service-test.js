const {
    describe, before, beforeEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const Web3 = require('web3');
const ImportUtilities = require('../../../modules/ImportUtilities');
const Utilities = require('./../../../modules/Utilities');
const Storage = require('../../../modules/Storage');
const models = require('../../../models');
const sample_data = require('../test_data/otjson-graph');
const defaultConfig = require('../../../config/config.json').mainnet;
const rc = require('rc');
const pjson = require('../../../package.json');
const logger = require('../../../modules/logger');
const awilix = require('awilix');
const PermissionedDataService = require('../../../modules/service/permissioned-data-service');
const MerkleTree = require('../../../modules/Merkle');
const crypto = require('crypto');
const abi = require('ethereumjs-abi');
const Encryption = require('../../../modules/RSAEncryption');


const samplePermissionedObject = {
    properties: {
        permissioned_data: {
            data: {
                'urn:ot:object:product:batch:humidity': '19.7',
                'urn:ot:object:product:batch:power_feeding': '85',
                'urn:ot:object:product:batch:productId': 'urn:ot:object:actor:id:KakaxiSN687',
                'urn:ot:object:product:batch:rainfall': '0.0',
                'urn:ot:object:product:batch:solar_radiation': '0.0',
                'urn:ot:object:product:batch:temperature': '22.0',
                vocabularyType: 'urn:ot:object:batch',
            },
        },
    },
};

let config;
let permissionedDataService;

class GraphStorageMock {
    constructor(log) {
        this.logger = log;
    }
}

describe('Permission data service test', () => {
    beforeEach('Setup container', async () => {
        // Create the container and set the injectionMode to PROXY (which is also the default).
        process.env.NODE_ENV = 'mainnet';
        const container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        const graphStorage = new GraphStorageMock(logger);

        config = rc(pjson.name, defaultConfig);
        container.register({
            config: awilix.asValue(config),
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
        });
        permissionedDataService = new PermissionedDataService(container.cradle);
    });

    it('Calculate the public data hash', () => {
        const originalGraph = Utilities
            .copyObject(sample_data.permissioned_data_graph);
        ImportUtilities.calculateGraphPermissionedDataHashes(originalGraph['@graph']);

        const shuffledGraph = Utilities
            .copyObject(sample_data.permissioned_data_graph_shuffled);
        ImportUtilities.calculateGraphPermissionedDataHashes(shuffledGraph['@graph']);

        const differentGraph = Utilities
            .copyObject(sample_data.permissioned_data_graph_2);
        ImportUtilities.calculateGraphPermissionedDataHashes(differentGraph['@graph']);

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

        assert.notEqual(
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

    it('Should correctly reconstruct encoded object', () => {
        const {
            permissioned_data_original_length, permissioned_data_array_length, key,
            encoded_data, permissioned_data_root_hash, encoded_data_root_hash,
        } = permissionedDataService.encodePermissionedData(samplePermissionedObject);

        const decoded_data = permissionedDataService.decodePermissionedData(
            encoded_data,
            key,
        );

        const result = permissionedDataService.reconstructPermissionedData(
            decoded_data,
            permissioned_data_array_length,
            permissioned_data_original_length,
        );

        assert.equal(
            Utilities.sortedStringify(samplePermissionedObject.properties.permissioned_data.data),
            Utilities.sortedStringify(result),
            'Reconstructed object is not the same as the original object',
        );
    });

    it('Should validate correct permissioned data tree with validatePermissionedDataTree', () => {
        const {
            permissioned_data_original_length, permissioned_data_array_length, key,
            encoded_data, permissioned_data_root_hash, encoded_data_root_hash,
        } = permissionedDataService.encodePermissionedData(samplePermissionedObject);

        const decodedPermissionedData = permissionedDataService
            .decodePermissionedData(encoded_data, key);

        const validationResult = permissionedDataService.validatePermissionedDataTree(
            decodedPermissionedData,
            permissioned_data_array_length,
        );

        assert(!validationResult.error, 'Correctly encoded data returned an error.');
    });

    it('Should report error for incorrect permissioned data tree with validatePermissionedDataTree', () => {
        const {
            permissioned_data_original_length, permissioned_data_array_length, key,
            encoded_data, permissioned_data_root_hash, encoded_data_root_hash,
        } = permissionedDataService.encodePermissionedData(samplePermissionedObject);

        const decodedPermissionedData = permissionedDataService
            .decodePermissionedData(encoded_data, key);

        const decodedDataMerkleTree = ImportUtilities
            .calculatePermissionedDataMerkleTree(samplePermissionedObject.properties.permissioned_data, 'purchase');
        const randomLevel = 2 +
            Math.floor(Math.random() * (decodedDataMerkleTree.levels.length - 2));
        const randomLeaf =
            Math.floor(Math.random() * decodedDataMerkleTree.levels[randomLevel].length);

        let corruptedIndex = randomLeaf;
        let inputIndex = randomLeaf * 2;
        for (let levelIndex = 1; levelIndex < randomLevel; levelIndex += 1) {
            const level = decodedDataMerkleTree.levels[levelIndex];
            if (level.length % 2 === 1) {
                corruptedIndex += level.length + 1;
            } else {
                corruptedIndex += level.length;
            }

            if (levelIndex > 1) {
                const previousLevel = decodedDataMerkleTree.levels[levelIndex - 1];
                if (previousLevel.length % 2 === 1) {
                    inputIndex += previousLevel.length + 1;
                } else {
                    inputIndex += previousLevel.length;
                }
            }
        }

        decodedPermissionedData[corruptedIndex] =
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        const validationResult = permissionedDataService.validatePermissionedDataTree(
            decodedPermissionedData,
            permissioned_data_array_length,
        );

        assert(validationResult.error, 'Corrupted decoded data passed validation.');
        assert.equal(validationResult.outputIndex, corruptedIndex, 'Reported output index is incorrect');
        assert.equal(validationResult.inputIndexLeft, inputIndex, 'Reported input index is incorrect');
    });

    it('Should validate correct permissioned data decoded root hash', () => {
        const {
            permissioned_data_original_length, permissioned_data_array_length, key,
            encoded_data, encoded_data_root_hash,
        } = permissionedDataService.encodePermissionedData(samplePermissionedObject);

        const permissionedDataRootHash = ImportUtilities
            .calculatePermissionedDataHash(samplePermissionedObject.properties.permissioned_data);

        const decodedPermissionedData = permissionedDataService
            .decodePermissionedData(encoded_data, key);

        const rootHashMatches = permissionedDataService
            .validatePermissionedDataRoot(decodedPermissionedData, permissionedDataRootHash);

        assert(rootHashMatches, 'Correct permissioned data root hash failed validation.');
    });

    it('Should report error for incorrect permissioned data decoded root hash', () => {
        const {
            permissioned_data_original_length, permissioned_data_array_length, key,
            encoded_data, encoded_data_root_hash,
        } = permissionedDataService.encodePermissionedData(samplePermissionedObject);

        const permissionedDataRootHash =
            '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        const decodedPermissionedData = permissionedDataService
            .decodePermissionedData(encoded_data, key);

        const rootHashMatches = permissionedDataService
            .validatePermissionedDataRoot(decodedPermissionedData, permissionedDataRootHash);

        assert(!rootHashMatches, 'Correct permissioned data root hash failed validation.');
    });

    it('Should generate a valid proof for incorrect data', () => {
        const blocks = [
            'A',
            'B',
            'C',
            'D',
            'E',
            'F',
        ];

        for (let i = 0; i < blocks.length; i += 1) {
            blocks[i] = Buffer.from(blocks[i]).toString('hex').padStart(64, '0');
        }

        const originalMerkleTree = new MerkleTree(blocks, 'purchase', 'soliditySha3');

        const {
            key,
            encoded_data,
            permissioned_data_root_hash,
            encoded_data_root_hash,
        } = permissionedDataService._encodePermissionedDataMerkleTree(originalMerkleTree);

        encoded_data[11] = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

        // 0 A \
        // 1 B - AB \
        // 2 C \     >- ABCD
        // 3 D - CD /        \
        // 4 E \              > - ABCDEFEF
        // 5 F - EF >- EFEF /
        // 6 AB
        // 7 CD
        // 8 EF
        // 9 (EF)
        // 10 ABCD
        // 11 EFEF
        // 12 ABCDEF

        const encodedMerkleTree = new MerkleTree(encoded_data, 'purchase', 'soliditySha3');

        const permissioned_data_array_length = 6;

        const decodedPermissionedData = permissionedDataService
            .decodePermissionedData(encoded_data, key);


        const validationResult = permissionedDataService.validatePermissionedDataTree(
            decodedPermissionedData,
            permissioned_data_array_length,
        );

        assert(validationResult.error, 'Corrupted decoded data passed validation.');
        assert.equal(validationResult.inputIndexLeft, 8);
        assert.equal(validationResult.outputIndex, 11);

        const {
            encodedInputLeft,
            encodedOutput,
            proofOfEncodedInputLeft,
            proofOfEncodedOutput,
        } = permissionedDataService.prepareNodeDisputeData(
            encoded_data,
            validationResult.inputIndexLeft,
            validationResult.outputIndex,
        );

        const outputProofResult = encodedMerkleTree.calculateProofResult(
            proofOfEncodedOutput,
            encodedOutput,
            validationResult.outputIndex,
        );
        assert.equal(
            Utilities.normalizeHex(outputProofResult),
            Utilities.normalizeHex(encodedMerkleTree.getRoot()),
            'Invalid Merkle proof for output element.',
        );

        const inputProofResult = encodedMerkleTree.calculateProofResult(
            proofOfEncodedInputLeft,
            encodedInputLeft,
            validationResult.inputIndexLeft,
        );
        assert.equal(
            Utilities.normalizeHex(inputProofResult),
            Utilities.normalizeHex(encodedMerkleTree.getRoot()),
            'Invalid Merkle proof for input element.',
        );

        const keyHash = abi.soliditySHA3(['bytes32', 'uint256'], [key, 8]);
        const calculatedInput = Encryption.xor(encodedInputLeft, keyHash);
        const decodedInput = decodedPermissionedData[validationResult.inputIndexLeft + 1];

        assert.equal(calculatedInput, decodedInput, 'Decoded and manually decoded hashes do not match.');
        assert.equal(decodedInput, originalMerkleTree.levels[2][2], 'Decoded and originally submitted hashes do not match.');

        const expectedHash =
            originalMerkleTree._generateInternalHash(calculatedInput, decodedInput);

        assert.equal(expectedHash, originalMerkleTree.levels[3][1], 'Calculated and originally submitted output hashes do not match');

        const actualHash = decodedPermissionedData[validationResult.outputIndex];
        assert.notEqual(actualHash, originalMerkleTree.levels[3][1], 'Original and corrupted output hashes match');
    });

    it('Calculate the root hash on one permissioned data object', () => {
        const originalObject = Utilities.copyObject(sample_data.permissioned_data_object);
        const shuffledObject = Utilities
            .copyObject(sample_data.permissioned_data_object_shuffled);
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
    // eslint-disable-next-line max-len
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
});
