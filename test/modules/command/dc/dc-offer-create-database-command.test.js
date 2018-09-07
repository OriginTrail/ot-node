/* eslint-disable no-unused-expressions */
const DCOfferCreateDatabaseCommand = require('../.././../../modules/command/dc/dc-offer-create-database-command');
const models = require('../../../../models/index');
const BN = require('bn.js');
const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
const Utilities = require('../.././../../modules/Utilities');
const GraphStorage = require('../.././../../modules/Database/GraphStorage');
const Storage = require('../.././../../modules/Storage');
const { Database } = require('arangojs');
const sequelizeConfig = require('../../../../config/config.json').development;
const CommandResolver = require('../.././../../modules/command/command-resolver');
const CommandExecutor = require('../.././../../modules/command/command-executor');
const awilix = require('awilix');
// const Models = require('../../../../models');

function buildSelectedDatabaseParam(databaseName) {
    return {
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: databaseName,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database_system: 'arango_db',
    };
}

describe.only('Check for dc offer create database command', function () {
    this.timeout(5000);
    let graphStorage;
    let systemDb;
    let myConfig;
    let myGraphStorage;
    let container;


    const databaseName = 'dc_offer_create_db';

    before('Setup models', async () => {
        Storage.models = (await models.sequelize.sync()).models;
    });

    before('precondition', async () => {
        systemDb = new Database();
        systemDb.useBasicAuth(process.env.DB_USERNAME, process.env.DB_PASSWORD);

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await systemDb.dropDatabase(databaseName);
        }

        await systemDb.createDatabase(
            databaseName,
            [{ username: process.env.DB_USERNAME, passwd: process.env.DB_PASSWORD, active: true }],
        );

        // Create the container and set the injectionMode to PROXY (which is also the default).
        container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });
        const logger = Utilities.getLogger();
        graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName), logger);

        container.register({
            logger: awilix.asValue(Utilities.getLogger()),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(Utilities.loadConfig()),
            commandResolver: awilix.asClass(CommandResolver),
            dcOfferCreateDatabaseCommand: awilix.asClass(DCOfferCreateDatabaseCommand),

        });
        myGraphStorage = await graphStorage.connect();
        myConfig = await container.resolve('config');
    });

    it('should console log', async () => {
        const myCommand = {
            data: {
                importId: 100005,
                replicationId: 2,
                rootHash: 3,
                total_escrow_time: 4,
                max_token_amount: 5,
                min_stake_amount: 6,
                min_reputation: 7,
            },
        };

        const dcOfferCreateDatabaseCommand = container.resolve('dcOfferCreateDatabaseCommand');

        models.sequelize.transaction(async t => dcOfferCreateDatabaseCommand.execute(myCommand, t));


        const listOfDatabases1 = await systemDb.listDatabases();
        const offer =
            await models.offers.findOne({ where: { import_id: myCommand.data.importId } });
    });

    after('Drop DB', async () => {
        if (systemDb) {
            const listOfDatabases = await systemDb.listDatabases();
            if (listOfDatabases.includes(databaseName)) {
                await systemDb.dropDatabase(databaseName);
            }
        }
    });
});
