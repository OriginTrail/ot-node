/* eslint-disable max-len */
const {
    describe, before, beforeEach, after, it,
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

describe.only('Checks DCOfferCreateBlockchainCommand execute() logic', function () {
    this.timeout(5000);
    let graphStorage;
    let systemDb;
    let myConfig;
    let myGraphStorage;
    let container;
    let myCommand;
    let insertedOfferId;
    let initializingOfferCalled = false;
    let getProfileCalled = false;
    let getReplicationModifierCalled = false;
    let depositTokenCalled = false;
    let increaseBiddingApprovalCalled = false;
    let createOfferCalled = false;
    let biddingStartedCalled = false;

    const databaseName = 'dc_offer_create_db';

    class MockRemoteControl {
        initializingOffer(someInput) {
            // console.log('Hi from initializingOffer()');
            initializingOfferCalled = true;
            return someInput;
        }
        biddingStarted(someInput) {
            // console.log('Hi from biddingStarted()');
            biddingStartedCalled = true;
            return someInput;
        }
    }

    class MockBlockchainWithLowProfileBalance {
        async getProfile(someInput) {
            // console.log('Hi from getProfile()');
            getProfileCalled = true;
            const profile = { balance: 2200000 };
            return profile;
        }
        async getReplicationModifier(someInput) {
            // console.log('Hi from getReplicationModifier()');
            getReplicationModifierCalled = true;
            return 3;
        }
        async increaseBiddingApproval(someInput) {
            console.log('Hi from increaseBiddingApproval()');
            increaseBiddingApprovalCalled = true;
            return someInput;
        }
        async depositToken(someInput) {
            console.log('Hi from depositToken()');
            depositTokenCalled = true;
            return someInput;
        }

        async createOffer(inputArg1, inputArg2, inputArg3, inputArg4, inputArg5, inputArg6, inputArg7, inputArg8, inputArg9, inputArg10) {
            // console.log('Hi from createOffer()');
            createOfferCalled = true;
            return 0;
        }
    }

    class MockBlockchainWithHighProfileBalance {
        async getProfile(someInput) {
            // console.log('Hi from getProfile()');
            getProfileCalled = true;
            const profile = { balance: 2895264000005 };
            return profile;
        }
        async getReplicationModifier(someInput) {
            // console.log('Hi from getReplicationModifier()');
            getReplicationModifierCalled = true;
            return 3;
        }
        async increaseBiddingApproval(someInput) {
            console.log('Hi from increaseBiddingApproval()');
            increaseBiddingApprovalCalled = true;
            return someInput;
        }
        async depositToken(someInput) {
            console.log('Hi from depositToken()');
            depositTokenCalled = true;
            return someInput;
        }

        async createOffer(inputArg1, inputArg2, inputArg3, inputArg4, inputArg5, inputArg6, inputArg7, inputArg8, inputArg9, inputArg10) {
            // console.log('Hi from createOffer()');
            createOfferCalled = true;
            return 0;
        }
    }

    beforeEach('Setup preconditions and call DCOfferCreateBlockchainCommand execute function', async () => {
        Storage.models = (await models.sequelize.sync()).models;
        Storage.db = models.sequelize;

        // make sure offers table is cleaned up
        await models.offers.destroy({
            where: {},
            truncate: true,
        });

        await sleep.sleep(1000);

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

        // container2 = awilix.createContainer({
        //     injectionMode: awilix.InjectionMode.PROXY,
        // });

        graphStorage = new GraphStorage(buildSelectedDatabaseParam(databaseName), logger);

        container.register({
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(Utilities.loadConfig()),
            blockchain: awilix.asClass(MockBlockchainWithLowProfileBalance),
            remoteControl: awilix.asClass(MockRemoteControl),
            commandResolver: awilix.asClass(CommandResolver),
            dcOfferCreateBlockchainCommand: awilix.asClass(DCOfferCreateBlockchainCommand),

        });

        // container2.register({
        //     logger: awilix.asValue(logger),
        //     graphStorage: awilix.asValue(graphStorage),
        //     config: awilix.asValue(Utilities.loadConfig()),
        //     blockchain: awilix.asClass(MockBlockchainWithHighProfileBalance),
        //     remoteControl: awilix.asClass(MockRemoteControl),
        //     commandResolver: awilix.asClass(CommandResolver),
        //     dcOfferCreateBlockchainCommand: awilix.asClass(DCOfferCreateBlockchainCommand),

        // });

        myGraphStorage = await graphStorage.connect();
        myConfig = await container.resolve('config');

        myCommand = {
            data: {
                importId: 5,
                minStakeAmount: 10000,
                maxTokenAmount: new BN(50000, 10),
                minReputation: 0,
                rootHash: '0xfe109af514aef462b86a02e032d1add2ce59a224cd095aa87716b1ad26aa08ca',
                dhIds: [],
                dhWallets: [],
                importSizeInBytes: new BN(13404, 10),
                totalEscrowTime: new BN(1440, 10),
                offerId: 0,
            },
        };

        let newOfferRow = {
            import_id: myCommand.data.importId,
            total_escrow_time: myCommand.data.totalEscrowTime.toString(),
            max_token_amount: myCommand.data.maxTokenAmount.toString(),
            min_stake_amount: myCommand.data.minStakeAmount,
            min_reputation: myCommand.data.minReputation,
            data_hash: myCommand.data.rootHash,
            data_size_bytes: myCommand.data.importSizeInBytes.toString(),
            dh_wallets: myCommand.data.dhWallets,
            dh_ids: myCommand.data.dhIds,
            message: 'Offer is pending',
            external_id: 666,
            start_tender_time: Date.now(), // TODO: Problem. Actual start time is returned by SC.
            status: 'PENDING',
        };

        // mimic task done by DCOfferCreateDatabaseCommand
        newOfferRow = await models.offers.create(newOfferRow, {});
        console.log(newOfferRow.id);
        myCommand.data.offerId = newOfferRow.id;
        insertedOfferId = newOfferRow.id;

        // allow some time for offer to be written to system.db
        await sleep.sleep(1000);

        const dcOfferCreateBlockchainCommand = await container.resolve('dcOfferCreateBlockchainCommand');
        // const dcOfferCreateBlockchainCommand2 = await container2.resolve('dcOfferCreateBlockchainCommand');

        // call command's execute function
        dcOfferCreateBlockchainCommand.execute(myCommand);
        // allow some time for offer to be updated in system.db
        await sleep.sleep(1000);
    });


    it('Check that right methods have been called and status is updated', async () => {
        assert.isTrue(initializingOfferCalled, 'remoteControl.initializingOffer() should be called');
        assert.isTrue(getProfileCalled, 'blockchain.getProfile() should be called');
        assert.isTrue(getReplicationModifierCalled, 'blockchain.getReplicationModifier() should be called');
        // in case profile satisfies condition
        // assert.isTrue(depositTokenCalled, "blockchain.depositToken() should be called");
        // assert.isTrue(increaseBiddingApprovalCalled, "blockchain.increaseBiddingApproval() should be called");
        assert.isTrue(createOfferCalled, 'blockchain.createOfferCalled() should be called');
        assert.isTrue(biddingStartedCalled, 'blockchain.biddingStartedCalled() should be called');

        const updatedOffer = await models.offers.findOne({ where: { id: insertedOfferId } });
        assert.equal(updatedOffer.status, 'STARTED', 'offer.status should be in STARTED state');
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
