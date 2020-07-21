const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const Web3 = require('web3');
const Storage = require('../../../modules/Storage');
const models = require('../../../models');


describe('Permission data service test', () => {

    // before('Setup models', async () => {
    //     Storage.models = (await models.sequelize.sync()).models;
    // });
    //
    // beforeEach('Setup ctx', async function setupCtx() {
    //     this.timeout(5000);
    //
    //     const config = rc(pjson.name, defaultConfig);
    //     systemDb = new Database();
    //     systemDb.useBasicAuth(config.database.username, config.database.password);
    //
    //     // Drop test database if exist.
    //     const listOfDatabases = await systemDb.listDatabases();
    //     if (listOfDatabases.includes(databaseName)) {
    //         await systemDb.dropDatabase(databaseName);
    //     }
    //
    //     await systemDb.createDatabase(
    //         databaseName,
    //         [{
    //             username: config.database.username,
    //             passwd: config.database.password,
    //             active: true,
    //         }],
    //     );
    //
    //     config.database.database = databaseName;
    //     config.erc725Identity = '0x611d771aAfaa3D6Fb66c4a81D97768300a6882D5';
    //     config.node_wallet = '0xa9a07f3c53ec5de8dd83039ca27fae83408e16f5';
    //     config.node_private_key =
    //     '952e45854ca5470a6d0b6cb86346c0e9c4f8f3a5a459657df8c94265183b9253';
    //
    //     // Create the container and set the injectionMode to PROXY (which is also the default).
    //     const container = awilix.createContainer({
    //         injectionMode: awilix.InjectionMode.PROXY,
    //     });
    //
    //     const web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt'));
    //
    //     graphStorage = new GraphStorage(config.database, logger);
    //     container.register({
    //         logger: awilix.asValue(logger),
    //         gs1Utilities: awilix.asClass(GS1Utilities),
    //         graphStorage: awilix.asValue(graphStorage),
    //         schemaValidator: awilix.asClass(SchemaValidator).singleton(),
    //         importService: awilix.asClass(ImportService).singleton(),
    //         epcisOtJsonTranspiler: awilix.asClass(EpcisOtJsonTranspiler).singleton(),
    //         remoteControl: awilix.asValue({
    //             importRequestData: () => {
    //             },
    //         }),
    //         network: awilix.asClass(Network),
    //         networkUtilities: awilix.asClass(NetworkUtilities),
    //         emitter: awilix.asClass(EventEmitter),
    //         product: awilix.asClass(Product),
    //         web3: awilix.asValue(web3),
    //         config: awilix.asValue(config),
    //         permissionedDataService: awilix.asClass(PermissionedDataService).singleton(),
    //     });
    //     await graphStorage.connect();
    //     importService = container.resolve('importService');
    //     epcisOtJsonTranspiler = container.resolve('epcisOtJsonTranspiler');
    // });
    //
    // it('Calculate the public root hash of one graph', () => {
    //     const originalGraph = Utilities.
    //     copyObject(sample_data.permissioned_data_graph['@graph']);
    //     ImportUtilities.calculateGraphPermissionedDataHashes(originalGraph);
    //
    //     const shuffledGraph = Utilities.
    //     copyObject(sample_data.permissioned_data_graph_shuffled['@graph']);
    //     ImportUtilities.calculateGraphPermissionedDataHashes(shuffledGraph);
    //
    //     const differentGraph = Utilities.
    //     copyObject(sample_data.permissioned_data_graph_2['@graph']);
    //     ImportUtilities.calculateGraphPermissionedDataHashes(differentGraph);
    //
    //     const originalGraphRootHash = ImportUtilities.calculateGraphPublicHash(originalGraph);
    //     const shuffledGraphRootHash = ImportUtilities.calculateGraphPublicHash(shuffledGraph);
    //     const differentGraphRootHash = ImportUtilities.calculateGraphPublicHash(differentGraph);
    //
    //     assert(originalGraphRootHash != null);
    //     assert(shuffledGraphRootHash != null);
    //     assert(differentGraphRootHash != null);
    //
    //     // Hashes should be 32 Bytes (64 characters) with 0x preceding the hash, so 66 characters
    //     assert(typeof originalGraphRootHash === 'string');
    //     assert(typeof shuffledGraphRootHash === 'string');
    //     assert(typeof differentGraphRootHash === 'string');
    //
    //     assert(originalGraphRootHash.length === 66);
    //     assert(shuffledGraphRootHash.length === 66);
    //     assert(differentGraphRootHash.length === 66);
    //
    //     assert.equal(
    //         originalGraphRootHash,
    //         shuffledGraphRootHash,
    //         'Graph root hash for same object with attributes in different order!',
    //     );
    //
    //     assert.notEqual(
    //         originalGraphRootHash,
    //         differentGraphRootHash,
    //         'Graph root hash for different objects is the same!',
    //     );
    // });
    //
    // it('Encoding verification', () => {
    //     const permissionedObject = {
    //         data: {
    //             'urn:ot:object:product:batch:humidity': '19.7',
    //             'urn:ot:object:product:batch:power_feeding': '85',
    //             'urn:ot:object:product:batch:productId': 'urn:ot:object:actor:id:KakaxiSN687',
    //             'urn:ot:object:product:batch:rainfall': '0.0',
    //             'urn:ot:object:product:batch:solar_radiation': '0.0',
    //             'urn:ot:object:product:batch:temperature': '22.0',
    //             vocabularyType: 'urn:ot:object:batch',
    //         },
    //     };
    //
    //     const {
    //         permissioned_data_original_length, permissioned_data_array_length, key,
    //         encoded_data, permissioned_data_root_hash, encoded_data_root_hash,
    //     } = ImportUtilities.encodePermissionedData(permissionedObject);
    //
    //     const result = ImportUtilities.validateAndDecodePermissionedData(
    //         encoded_data,
    //         key,
    //         permissioned_data_array_length,
    //         permissioned_data_original_length,
    //     );
    //
    //     assert.equal(
    //         Utilities.sortedStringify(permissionedObject.data),
    //         Utilities.sortedStringify(result.permissionedData),
    //     );
    // });
    //
    // it('Calculate the root hash on one permissioned data object', () => {
    //     const originalObject = Utilities.copyObject(sample_data.permissioned_data_object);
    //     const shuffledObject = Utilities.
    //     copyObject(sample_data.permissioned_data_object_shuffled);
    //     const differentObject = Utilities.copyObject(sample_data.permissioned_data_object_2);
    //
    //     const originalRootHash = ImportUtilities.calculatePermissionedDataHash(originalObject);
    //     const shuffledRootHash = ImportUtilities.calculatePermissionedDataHash(shuffledObject);
    //     const differentRootHash = ImportUtilities.calculatePermissionedDataHash(differentObject);
    //
    //     assert(originalRootHash != null);
    //     assert(shuffledRootHash != null);
    //     assert(differentRootHash != null);
    //
    //     // Hashes should be 32 Bytes (64 characters) with 0x preceding the hash, so 66 characters
    //     assert(typeof originalRootHash === 'string');
    //     assert(typeof shuffledRootHash === 'string');
    //     assert(typeof differentRootHash === 'string');
    //
    //     assert(originalRootHash.length === 66);
    //     assert(shuffledRootHash.length === 66);
    //     assert(differentRootHash.length === 66);
    //
    //     assert.equal(
    //         originalRootHash,
    //         shuffledRootHash,
    //         'Permissioned data root hash for same object with attributes in different order!',
    //     );
    //
    //     assert.notEqual(
    //         originalRootHash,
    //         differentRootHash,
    //         'Permisssioned data root hash for different objects is the same!',
    //     );
    // });
    // it('Calculating the root hash of an empty permissioned
    // data object should throw an error', () => {
    //     const testObject = {};
    //
    //     let errorHappened = false;
    //     try {
    //         ImportUtilities.calculatePermissionedDataHash(testObject);
    //     } catch (e) {
    //         errorHappened = true;
    //         assert.equal(
    //             e.message,
    //             'Cannot calculate root hash of an empty object',
    //             'Unexpected error received',
    //         );
    //     }
    //
    //     assert(errorHappened, 'calculatePermissionedDataHash did not throw an error!');
    // });
});
