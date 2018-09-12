const {
    describe, before, after, it,
} = require('mocha');
const { assert } = require('chai');
const DCOfferCreateBlockchainCommand = require('../../../../modules/command/dc/dc-offer-create-blockchain-command');
const models = require('../../../../models');
const Storage = require('../../../../modules/Storage');
const BN = require('bn.js');
const sleep = require('sleep-async')().Promise;
const Utilities = require('../../../../modules/Utilities');
const Blockchain = require('../../../../modules/Blockchain');
const GraphStorage = require('../../../../modules/Database/GraphStorage');
const { Database } = require('arangojs');
const CommandResolver = require('../../../../modules/command/command-resolver');
const awilix = require('awilix');

const logger = Utilities.getLogger();

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

describe.only('Checks DCOfferCreateBlockchainCommand', function () {
    this.timeout(5000);
    let graphStorage;
    let systemDb;
    let myConfig;
    let myGraphStorage;
    let container;
    let myCommand;

    const databaseName = 'dc_offer_create_db';

    class MockRemoteControl {
        writingRootHash() {
            console.log('Hi from writingRootHash()');
            return 0;
        }
        initializingOffer(input_arg_1) {
            console.log('Hi from initializingOffer()');
            return input_arg_1;
        }
        biddingStarted(input_arg_1) {
            console.log('Hi from biddingStarted()');
            return input_arg_1;
        }
        cancelingOffer() {
            console.log('Hi from cancelingOffer()');
            return 0;
        }
        biddingComplete() {
            console.log('Hi from biddingComplete()');
        }
        choosingBids() {
            console.log('Hi from choosingBids()');
            return 0;
        }
        bidChosen() {
            console.log('Hi from bidChosen()');
            return 0;
        }
        offerFinalized() {
            console.log('Hi from offerFinalized()');
            return 0;
        }
        dcErrorHandling() {
            console.log('Hi from dcErrorHandling()');
            return 0;
        }
        bidNotTaken() {
            console.log('Hi from bidNotTaken()');
            return 0;
        }
    }

    class MockBlockchain {
        async getProfile(input_argument){
            console.log('Hi from getProfile()');
            return 10000;
        }
        async getReplicationModifier(input_argument){
            console.log('Hi from getReplicationModifier()');
            return 3;
        }
        async increaseBiddingApproval(){
            console.log('Hi from getReplicationModifier()');
            return input_argument;  
        }
        async depositToken(input_argument){
            console.log('Hi from depositToken()');
            return input_argument;  
        }

        async createOffer(input_arg_1, input_arg_2, input_arg_3, input_arg_4, input_arg_5, input_arg_6, input_arg_7, input_arg_8, input_arg_9, input_arg_10 ){
            console.log('Hi from depositToken()');
            return 0;  
        }
    }

    before('Setup preconditions and call DCOfferCreateBlockchainCommand execute function', async () => {
        Storage.models = (await models.sequelize.sync()).models;
        Storage.db = models.sequelize;

        // make sure offers table is cleaned up
        await models.offers.destroy({
            where: {},
            truncate: true,
        });

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

        graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName), logger);

        container.register({
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(Utilities.loadConfig()),
            blockchain: awilix.asClass(MockBlockchain),
            remoteControl: awilix.asClass(MockRemoteControl),
            commandResolver: awilix.asClass(CommandResolver),
            dcOfferCreateBlockchainCommand: awilix.asClass(DCOfferCreateBlockchainCommand),

        });
        myGraphStorage = await graphStorage.connect();
        myConfig = await container.resolve('config');

        myCommand = {
            data: {
                importId: 5,
                minStakeAmount: 10e12,
                maxTokenAmount: new BN(350000000, 10),
                minReputation: 0,
                rootHash: '0xfe109af514aef462b86a02e032d1add2ce59a224cd095aa87716b1ad26aa08ca',
                dhIds: ['123', '321'],
                dhWallets: ['0xAC13a2D4cCD1d7Ba29517F96b4eD84D652be5EbD'],
                importSizeInBytes: 300,
                totalEscrowTime: 9640000,
                offerId: 1,
            },
        };

        let newOfferRow = {
            import_id: myCommand.data.importId,
            total_escrow_time: myCommand.data.totalEscrowTime,
            max_token_amount: myCommand.data.maxTokenAmount,
            min_stake_amount: myCommand.data.minStakeAmount,
            min_reputation: myCommand.data.minReputation,
            data_hash: myCommand.data.rootHash,
            data_size_bytes: myCommand.data.afterimportSizeInBytes,
            dh_wallets: myCommand.data.dhWallets,
            dh_ids: myCommand.data.dhIds,
            message: 'Offer is pending',
            external_id: 666,
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            status: 'PENDING',
        };
        newOfferRow = await models.offers.create(newOfferRow, { });

        let offerId = newOfferRow.id;

        // allow some time for offer to be written to system.db
        await sleep.sleep(1000);

        const dcOfferCreateBlockchainCommand = container.resolve('dcOfferCreateBlockchainCommand');

        // call command's execute function
        // eslint-disable-next-line max-len
        // models.sequelize.transaction(async t => dcOfferCreateBlockchainCommand.execute(myCommand.data, t));

        dcOfferCreateBlockchainCommand.execute(myCommand);
    });


    it('Check to be created later', async () => {
        assert.isTrue(2 > 1);

        // check that offer status has been updated to STARTED
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
