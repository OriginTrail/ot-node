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

    it('Encoding verification', () => {
        const permissionedObject = {
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

        const {
            permissioned_data_original_length, permissioned_data_array_length, key,
            encoded_data, permissioned_data_root_hash, encoded_data_root_hash,
        } = permissionedDataService.encodePermissionedData(permissionedObject);

        const result = permissionedDataService.validateAndDecodePermissionedData(
            encoded_data,
            key,
            permissioned_data_array_length,
            permissioned_data_original_length,
        );

        assert.equal(
            Utilities.sortedStringify(permissionedObject.properties.permissioned_data.data),
            Utilities.sortedStringify(result.permissionedData),
        );
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
