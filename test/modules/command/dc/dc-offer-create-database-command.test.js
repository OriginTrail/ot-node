const {
    describe, before, after, it,
} = require('mocha');
const { assert } = require('chai');

const sleep = require('sleep-async')().Promise;
const awilix = require('awilix');
const rc = require('rc');
const { Database } = require('arangojs');

const models = require('../../../../models/index');
const Utilities = require('../.././../../modules/Utilities');
const GraphStorage = require('../.././../../modules/Database/GraphStorage');
const CommandResolver = require('../.././../../modules/command/command-resolver');
const DCOfferCreateDatabaseCommand = require('../.././../../modules/command/dc/dc-offer-create-db-command');

const defaultConfig = require('../../../../config/config.json').development;
const pjson = require('../../../../package.json');

const logger = require('../../../../modules/logger');

const testUtilities = require('../../test-utilities');

describe('Checks DCOfferCreateDatabaseCommand execute() logic', function () {
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

    before('Setup preconditions and call DCOfferCreateDatabaseCommand execute function', async () => {
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

        container.register({
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(config),
            commandResolver: awilix.asClass(CommandResolver),
            dcOfferCreateDatabaseCommand: awilix.asClass(DCOfferCreateDatabaseCommand),

        });
        myGraphStorage = await graphStorage.connect();
        myConfig = await container.resolve('config');

        const dataSetId = `0x${'1234'.padStart(64, '0')}`;
        const offer = await models.offers.create({
            data_set_id: dataSetId,
            message: 'Offer is pending',
            status: 'PENDING',
            global_status: 'PENDING',
        });

        myCommand = {
            data: {
                dataSetId,
                internalOfferId: offer.id,
                dataRootHash: '0xfe109af514aef462b86a02e032d1add2ce59a224cd095aa87716b1ad26aa08ca',
                redLitigationHash: `0x${'2456'.padStart(64, '0')}`,
                blueLitigationHash: `0x${'2457'.padStart(64, '0')}`,
                greenLitigationHash: `0x${'2458'.padStart(64, '0')}`,
                holdingTimeInMinutes: 60,
                tokenAmountPerHolder: Utilities.getRandomIntRange(5000, 10000),
                litigationIntervalInMinutes: 10,
                dataSizeInBytes: 1000,
            },
        };

        const dcOfferCreateDatabaseCommand = container.resolve('dcOfferCreateDatabaseCommand');

        // call command's execute function
        models.sequelize.transaction(async t => dcOfferCreateDatabaseCommand.execute(myCommand, t));
    });


    it('Check that new offer gets created based on the given parameters', async () => {
        // allow some time for offer to be written to system.db
        await sleep.sleep(1000);

        const offer =
            await models.offers.findOne({ where: { data_set_id: myCommand.data.dataSetId } });

        assert.equal(myCommand.data.dataSetId, offer.dataValues.data_set_id, 'data sets do not match');
        assert.equal(myCommand.data.redLitigationHash, offer.dataValues.red_litigation_hash, 'red litigations hashes do not match');
        assert.equal(myCommand.data.blueLitigationHash, offer.dataValues.blue_litigation_hash, 'blue litigations hashes do not match');
        assert.equal(myCommand.data.greenLitigationHash, offer.dataValues.green_litigation_hash, 'green litigations hashes do not match');
        assert.equal(myCommand.data.holdingTimeInMinutes, offer.dataValues.holding_time_in_minutes, 'holding time(s) in minute do not match');
        assert.equal(myCommand.data.tokenAmountPerHolder, offer.dataValues.token_amount_per_holder, 'token amounts do not match');
        assert.equal(myCommand.data.litigationIntervalInMinutes, offer.dataValues.litigation_interval_in_minutes, 'litigation intervals do not match');
        assert.equal('PREPARED', offer.dataValues.status, 'statuses do not match');
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
