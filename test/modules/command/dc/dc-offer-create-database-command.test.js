/* eslint-disable no-unused-expressions */
const DCOfferCreateDatabaseCommand = require('../.././../../modules/command/dc/dc-offer-create-database-command');
const models = require('../../../../models/index');
const SystemStorage = require('../../../../modules/Database/SystemStorage');

const BN = require('bn.js');
const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
const { assert, expect } = require('chai');
const sleep = require('sleep-async')().Promise;
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
    let myCommand;


    const databaseName = 'dc_offer_create_db';


    before('Setup models', async () => {
        try {
            await SystemStorage.connect();
        } catch (error) {
            console.log('Smth went wrong with SystemStorage.connect()');
            console.log(error);
        }

        try {
            await SystemStorage.runSystemQuery('DELETE FROM offers', []);
            console.log('offers deleted');
        } catch (error) {
            console.log('Smth went wrong with SystemStorage.runSystemQuery()');
            console.log(error);
        }

        Storage.models = (await models.sequelize.sync()).models;

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

        myCommand = {
            data: {
                importId: Utilities.getRandomIntRange(0, 50),
                replicationId: Utilities.getRandomIntRange(0, 50),
                rootHash: Utilities.getRandomIntRange(0, 30),
                total_escrow_time: Utilities.getRandomIntRange(2, 100),
                max_token_amount: Utilities.getRandomIntRange(0, 100),
                min_stake_amount: Utilities.getRandomIntRange(0, 100),
                min_reputation: Utilities.getRandomIntRange(0, 100),
            },
        };

        const dcOfferCreateDatabaseCommand = container.resolve('dcOfferCreateDatabaseCommand');

        models.sequelize.transaction(async t => dcOfferCreateDatabaseCommand.execute(myCommand, t));
    });


    it('should console log', async () => {
        await sleep.sleep(1000);
        const offer =
            await models.offers.findOne({ where: { import_id: myCommand.data.importId } });
        console.log(offer, 'ovo je offer');

        assert.equal(myCommand.data.importId, offer.dataValues.import_id, 'import do not match');
        assert.equal(myCommand.data.replicationId, offer.dataValues.external_id, 'replication id  do not match');
        assert.equal(myCommand.data.rootHash, offer.dataValues.data_hash, 'root hash do not match');
        // assert.equal(myCommand.data.total_escrow_time, offer.dataValues.total_escrow_time, 'total escrow time do not match');
        assert.equal(myCommand.data.max_token_amount, offer.dataValues.max_token_amount, 'max token amount do not match');
        assert.equal(myCommand.data.min_stake_amount, offer.dataValues.min_stake_amount, 'min stake amount do not match');
        assert.equal(myCommand.data.min_reputation, offer.dataValues.min_reputation, 'min reputation do not match');
        assert.equal('PENDING', offer.dataValues.status, 'status do not match');
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
