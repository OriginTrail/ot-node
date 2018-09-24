const {
    describe, before, after, it,
} = require('mocha');
const { assert } = require('chai');

const BN = require('bn.js');
const sleep = require('sleep-async')().Promise;
const awilix = require('awilix');
const rc = require('rc');
const { Database } = require('arangojs');

const models = require('../../../../models/index');
const Storage = require('../../../../modules/Storage');
const Utilities = require('../.././../../modules/Utilities');
const GraphStorage = require('../.././../../modules/Database/GraphStorage');
const CommandResolver = require('../.././../../modules/command/command-resolver');
const DCOfferCreateDatabaseCommand = require('../.././../../modules/command/dc/dc-offer-create-database-command');

const defaultConfig = require('../../../../config/config.json').development;
const pjson = require('../../../../package.json');

const logger = Utilities.getLogger();

describe('Checks DCOfferCreateDatabaseCommand execute() logic', function () {
    this.timeout(5000);
    let config;
    let selectedDatabase;
    let graphStorage;
    let systemDb;
    let myConfig;
    let myGraphStorage;
    let container;
    let myCommand;

    const databaseName = 'dc_offer_create_db';

    before('Setup preconditions and call DCOfferCreateDatabaseCommand execute function', async () => {
        config = rc(pjson.name, defaultConfig);
        selectedDatabase = config.database;
        selectedDatabase.database = databaseName;

        Storage.models = (await models.sequelize.sync()).models;
        Storage.db = models.sequelize;

        // make sure offers table is cleaned up

        await models.offers.destroy({
            where: {},
            truncate: true,
        });

        systemDb = new Database();
        systemDb.useBasicAuth(config.database.username, config.database.password);

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await systemDb.dropDatabase(databaseName);
        }

        await systemDb.createDatabase(
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

        graphStorage = new GraphStorage(selectedDatabase, logger);

        container.register({
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(config),
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


    it('Check that new offer gets created based on the given parameters', async () => {
        // allow some time for offer to be written to system.db
        await sleep.sleep(1000);

        const offer =
            await models.offers.findOne({ where: { import_id: myCommand.data.importId } });

        assert.equal(myCommand.data.importId, offer.dataValues.import_id, 'imports do not match');
        assert.equal(myCommand.data.replicationId, offer.dataValues.external_id, 'replication ids do not match');
        assert.equal(myCommand.data.rootHash, offer.dataValues.data_hash, 'root hashs do not match');
        assert.equal(myCommand.data.max_token_amount, offer.dataValues.max_token_amount, 'max token amounts do not match');
        assert.equal(myCommand.data.min_stake_amount, offer.dataValues.min_stake_amount, 'min stake amounts do not match');
        assert.equal(myCommand.data.min_reputation, offer.dataValues.min_reputation, 'min reputations do not match');
        let temp = new BN(myCommand.data.total_escrow_time);
        temp = temp.div(new BN(60000));
        assert.equal(offer.dataValues.total_escrow_time.toString(), temp.toString(), 'total_escrow_time do not match');
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
