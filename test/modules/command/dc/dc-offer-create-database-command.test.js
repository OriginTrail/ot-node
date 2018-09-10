/* eslint-disable no-unused-expressions */
const {
    describe, before, after, it,
} = require('mocha');
const { assert, expect } = require('chai');
const DCOfferCreateDatabaseCommand = require('../.././../../modules/command/dc/dc-offer-create-database-command');
const models = require('../../../../models/index');
const SystemStorage = require('../../../../modules/Database/SystemStorage');
const BN = require('bn.js');
const sleep = require('sleep-async')().Promise;
const Utilities = require('../.././../../modules/Utilities');
const GraphStorage = require('../.././../../modules/Database/GraphStorage');
const Storage = require('../.././../../modules/Storage');
const { Database } = require('arangojs');
const CommandResolver = require('../.././../../modules/command/command-resolver');
const CommandExecutor = require('../.././../../modules/command/command-executor');
const awilix = require('awilix');

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

describe.only('Checks for dc offer create database command', function () {
    this.timeout(5000);
    let graphStorage;
    let systemDb;
    let myConfig;
    let myGraphStorage;
    let container;
    let myCommand;

    const databaseName = 'dc_offer_create_db';

    before('Setup preconditions and call command execute function', async () => {
        try {
            await SystemStorage.connect();
        } catch (error) {
            console.log('Smth went wrong with SystemStorage.connect()');
            console.log(error);
        }
        // clean offers table from system.db
        try {
            await SystemStorage.runSystemQuery('DELETE FROM offers', []);
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
                importId: Utilities.getRandomIntRange(1, 50),
                replicationId: Utilities.getRandomIntRange(1, 50),
                rootHash: '0xfe109af514aef462b86a02e032d1add2ce59a224cd095aa87716b1ad26aa08ca',
                total_escrow_time: 9640000,
                max_token_amount: Utilities.getRandomIntRange(5000, 10000),
                min_stake_amount: Utilities.getRandomIntRange(1000, 2000),
                min_reputation: Utilities.getRandomIntRange(1, 100),
            },
        };

        const dcOfferCreateDatabaseCommand = container.resolve('dcOfferCreateDatabaseCommand');

        // call command's execute function
        models.sequelize.transaction(async t => dcOfferCreateDatabaseCommand.execute(myCommand, t));
    });


    it('Check that offer gets created based on given parameters', async () => {
        // allow some time for offer to be written to system.db
        await sleep.sleep(1000);

        const offer =
            await models.offers.findOne({ where: { import_id: myCommand.data.importId } });
        // console.log(offer.dataValues);

        assert.equal(myCommand.data.importId, offer.dataValues.import_id, 'imports do not match');
        assert.equal(myCommand.data.replicationId, offer.dataValues.external_id, 'replication ids do not match');
        assert.equal(myCommand.data.rootHash, offer.dataValues.data_hash, 'root hashs do not match');
        assert.equal(myCommand.data.max_token_amount, offer.dataValues.max_token_amount, 'max token amounts do not match');
        assert.equal(myCommand.data.min_stake_amount, offer.dataValues.min_stake_amount, 'min stake amounts do not match');
        assert.equal(myCommand.data.min_reputation, offer.dataValues.min_reputation, 'min reputations do not match');
        assert.equal('PENDING', offer.dataValues.status, 'statuses do not match');
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
