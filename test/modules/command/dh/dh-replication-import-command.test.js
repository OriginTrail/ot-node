const {
    describe, before, after, it,
} = require('mocha');
const { assert } = require('chai');

const Web3 = require('web3');
const awilix = require('awilix');
const rc = require('rc');
const { Database } = require('arangojs');

const models = require('../../../../models/index');
const Importer = require('../../../../modules/importer');
const GraphStorage = require('../.././../../modules/Database/GraphStorage');
const CommandResolver = require('../.././../../modules/command/command-resolver');
const DHReplicationImportCommand = require('../.././../../modules/command/dh/dh-replication-import-command');
const OtJsonImporter = require('../../../../modules/importer/ot-json-importer');
const EpcisOtJsonTranspiler = require('../../../../modules/transpiler/epcis/epcis-otjson-transpiler');

const defaultConfig = require('../../../../config/config.json').development;
const pjson = require('../../../../package.json');

const logger = require('../../../../modules/logger');

const testUtilities = require('../../test-utilities');

describe('Checks DHReplicationImportCommand execute() logic', function () {
    this.timeout(5000);
    let config;
    let selectedArangoDatabase;
    let graphStorage;
    let arangoDb;
    let myConfig;
    let myGraphStorage;
    let container;
    let myCommand;

    const databaseName = 'dc_offer_create_db';

    before('Setup preconditions and call DHReplicationImportCommand execute function', async () => {
        config = rc(pjson.name, defaultConfig);
        await testUtilities.recreateDatabase();

        // make sure offers table is cleaned up

        await models.offers.destroy({
            where: {},
            truncate: true,
        });

        arangoDb = new Database();
        arangoDb.useBasicAuth(config.database.username, config.database.password);

        // Drop test database if exist.
        const listOfDatabases = await arangoDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await arangoDb.dropDatabase(databaseName);
        }

        await arangoDb.createDatabase(
            databaseName,
            [{
                username: config.database.username,
                passwd: config.database.password,
                active: true,
            }],
        );

        // Create the container and set the injectionMode to PROXY (which is also the default).
        container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });

        selectedArangoDatabase = config.database;
        selectedArangoDatabase.database = databaseName;
        graphStorage = new GraphStorage(selectedArangoDatabase, logger);

        const mockRemoteControl = {
            lastData: null,
            offerUpdate: (data) => {
                this.lastData = data;
            },
        };

        container.register({
            web3: awilix.asValue(new Web3()),
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(config),
            remoteControl: awilix.asValue(mockRemoteControl),
            commandResolver: awilix.asClass(CommandResolver),
            dhReplicationImportCommand: awilix.asClass(DHReplicationImportCommand),
            transport: awilix.asValue({
                replicationFinished: () => {},
            }),
            importer: awilix.asClass(Importer).singleton(),
            gs1Importer: awilix.asValue({}),
            wotImporter: awilix.asValue({}),
            notifyError: awilix.asValue({}),
            gs1Utilities: awilix.asValue({}),
            otJsonImporter: awilix.asClass(OtJsonImporter).singleton(),
            epcisOtJsonTranspiler: awilix.asClass(EpcisOtJsonTranspiler).singleton(),
        });
        myGraphStorage = await graphStorage.connect();
        myConfig = await container.resolve('config');

        myCommand = {
            data: {
                // insert data here
            },
        };

        const dhReplicationImportCommand = container.resolve('dhReplicationImportCommand');

        // call command's execute function
        models.sequelize.transaction(async t => dhReplicationImportCommand.execute(myCommand, t));
    });


    it('Add test here', async () => {

    });

    after('Drop DB', async () => {
        if (arangoDb) {
            const listOfDatabases = await arangoDb.listDatabases();
            if (listOfDatabases.includes(databaseName)) {
                await arangoDb.dropDatabase(databaseName);
            }
        }
    });
});
