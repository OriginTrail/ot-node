const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { assert } = require('chai');
const sleep = require('sleep-async')().Promise;
const { Database } = require('arangojs');
const BN = require('bn.js');
const rc = require('rc');

const DCOfferCreateBlockchainCommand = require('../../../../modules/command/dc/dc-offer-create-bc-command');
const models = require('../../../../models');
const Utilities = require('../../../../modules/Utilities');
const GraphStorage = require('../../../../modules/Database/GraphStorage');

const CommandResolver = require('../../../../modules/command/command-resolver');
const awilix = require('awilix');

const defaultConfig = require('../../../../config/config.json').development;
const pjson = require('../../../../package.json');

const logger = require('../../../../modules/logger');

const testUtilities = require('../../test-utilities');

describe.skip('Checks DCOfferCreateBlockchainCommand execute() logic', function () {
    this.timeout(5000);
    let config;
    let selectedDatabase;
    let graphStorage;
    let systemDb;
    let myConfig;
    let myGraphStorage;
    let container;
    let dcOfferCreateBlockchainCommand;
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
            initializingOfferCalled = true;
            return someInput;
        }
        biddingStarted(someInput) {
            biddingStartedCalled = true;
            return someInput;
        }
    }

    class MockBlockchainWithLowProfileBalance {
        async getProfile(someInput) {
            getProfileCalled = true;
            const profile = { balance: 2200000 };
            return profile;
        }
        async getReplicationModifier(someInput) {
            getReplicationModifierCalled = true;
            return 3;
        }
        async increaseBiddingApproval(someInput) {
            increaseBiddingApprovalCalled = true;
            return someInput;
        }
        async depositToken(someInput) {
            depositTokenCalled = true;
            return someInput;
        }

        async createOffer(
            inputArg1, inputArg2, inputArg3,
            inputArg4, inputArg5, inputArg6,
            inputArg7, inputArg8, inputArg9,
            inputArg10,
        ) {
            createOfferCalled = true;
            return 0;
        }
    }

    class MockBlockchainWithHighProfileBalance extends MockBlockchainWithLowProfileBalance {
        async getProfile(someInput) {
            getProfileCalled = true;
            const profile = { balance: 2895264000005 };
            return profile;
        }
    }

    class MockBlockchainWithEqualProfileBalance extends MockBlockchainWithLowProfileBalance {
        async getProfile(someInput) {
            getProfileCalled = true;
            const profile = { balance: 2895264000000 };
            return profile;
        }
    }

    beforeEach('Inject offer into system database', async () => {
        config = rc(pjson.name, defaultConfig);
        selectedDatabase = config.database;
        selectedDatabase.database = databaseName;

        await testUtilities.recreateDatabase();

        // make sure offers table is cleaned up
        await models.offers.destroy({
            where: {},
            truncate: true,
        });

        // allow some time for table to be deleted from system.db
        await sleep.sleep(1000);

        systemDb = new Database();
        systemDb.useBasicAuth(
            selectedDatabase.username,
            selectedDatabase.password,
        );

        // Drop test database if exist.
        const listOfDatabases = await systemDb.listDatabases();
        if (listOfDatabases.includes(databaseName)) {
            await systemDb.dropDatabase(databaseName);
        }

        await systemDb.createDatabase(
            databaseName,
            [{
                username: selectedDatabase.username,
                passwd: selectedDatabase.password,
                active: true,
            }],
        );

        graphStorage = new GraphStorage(selectedDatabase, logger);
        myGraphStorage = await graphStorage.connect();

        myCommand = {
            data: {
                importId: Utilities.getRandomIntRange(10, 100),
                minStakeAmount: 10000,
                maxTokenAmount: new BN(50000, 10),
                minReputation: 0,
                rootHash: '0xfe109af514aef462b86a02e032d1add2ce59a224cd095aa87716b1ad26aa08ca',
                dhIds: [],
                dhWallets: [],
                importSizeInBytes: new BN(13404, 10),
                totalEscrowTime: new BN(1440, 10),
                offerId: 0, // to be updated once row is injected into db
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
            start_tender_time: Date.now(),
            status: 'PENDING',
        };

        // mimic task done by DCOfferCreateDatabaseCommand
        newOfferRow = await models.offers.create(newOfferRow, {});
        insertedOfferId = newOfferRow.id;

        // pass offer id to command
        myCommand.data.offerId = insertedOfferId;

        // allow some time for offer to be written to system.db
        await sleep.sleep(1000);

        container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });
    });

    it('profile balance less then condition', async () => {
        container.register({
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(config),
            blockchain: awilix.asClass(MockBlockchainWithLowProfileBalance),
            remoteControl: awilix.asClass(MockRemoteControl),
            commandResolver: awilix.asClass(CommandResolver),
            dcOfferCreateBlockchainCommand: awilix.asClass(DCOfferCreateBlockchainCommand),

        });

        myConfig = await container.resolve('config');
        dcOfferCreateBlockchainCommand = await container.resolve('dcOfferCreateBlockchainCommand');

        // call command's execute function
        dcOfferCreateBlockchainCommand.execute(myCommand);
        // allow some time for offer to be updated in system.db
        await sleep.sleep(1000);

        assert.isTrue(initializingOfferCalled, 'remoteControl.initializingOffer() should be called');
        assert.isTrue(getProfileCalled, 'blockchain.getProfile() should be called');
        assert.isTrue(getReplicationModifierCalled, 'blockchain.getReplicationModifier() should be called');
        assert.isTrue(depositTokenCalled, 'blockchain.depositToken() should be called');
        assert.isTrue(increaseBiddingApprovalCalled, 'blockchain.increaseBiddingApproval() should be called');
        assert.isTrue(createOfferCalled, 'blockchain.createOfferCalled() should be called');
        assert.isTrue(biddingStartedCalled, 'remoteControl.biddingStartedCalled() should be called');

        const updatedOffer = await models.offers.findOne({ where: { id: insertedOfferId } });
        assert.equal(updatedOffer.status, 'STARTED', 'offer.status should be in STARTED state');
    });

    it('profile balance greater then condition', async () => {
        container.register({
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(config),
            blockchain: awilix.asClass(MockBlockchainWithHighProfileBalance),
            remoteControl: awilix.asClass(MockRemoteControl),
            commandResolver: awilix.asClass(CommandResolver),
            dcOfferCreateBlockchainCommand: awilix.asClass(DCOfferCreateBlockchainCommand),

        });

        myConfig = await container.resolve('config');
        dcOfferCreateBlockchainCommand = await container.resolve('dcOfferCreateBlockchainCommand');

        // call command's execute function
        dcOfferCreateBlockchainCommand.execute(myCommand);
        // allow some time for offer to be updated in system.db
        await sleep.sleep(1000);

        assert.isTrue(initializingOfferCalled, 'remoteControl.initializingOffer() should be called');
        assert.isTrue(getProfileCalled, 'blockchain.getProfile() should be called');
        assert.isTrue(getReplicationModifierCalled, 'blockchain.getReplicationModifier() should be called');
        assert.isFalse(depositTokenCalled, 'blockchain.depositToken() should not be called');
        assert.isFalse(increaseBiddingApprovalCalled, 'blockchain.increaseBiddingApproval() should not be called');
        assert.isTrue(createOfferCalled, 'blockchain.createOfferCalled() should be called');
        assert.isTrue(biddingStartedCalled, 'remoteControl.biddingStartedCalled() should be called');

        const updatedOffer = await models.offers.findOne({ where: { id: insertedOfferId } });
        assert.equal(updatedOffer.status, 'STARTED', 'offer.status should be in STARTED state');
    });

    it('profile balance equals the condition', async () => {
        container.register({
            logger: awilix.asValue(logger),
            graphStorage: awilix.asValue(graphStorage),
            config: awilix.asValue(config),
            blockchain: awilix.asClass(MockBlockchainWithEqualProfileBalance),
            remoteControl: awilix.asClass(MockRemoteControl),
            commandResolver: awilix.asClass(CommandResolver),
            dcOfferCreateBlockchainCommand: awilix.asClass(DCOfferCreateBlockchainCommand),

        });

        myConfig = await container.resolve('config');
        dcOfferCreateBlockchainCommand = await container.resolve('dcOfferCreateBlockchainCommand');

        // call command's execute function
        dcOfferCreateBlockchainCommand.execute(myCommand);
        // allow some time for offer to be updated in system.db
        await sleep.sleep(1000);

        assert.isTrue(initializingOfferCalled, 'remoteControl.initializingOffer() should be called');
        assert.isTrue(getProfileCalled, 'blockchain.getProfile() should be called');
        assert.isTrue(getReplicationModifierCalled, 'blockchain.getReplicationModifier() should be called');
        assert.isFalse(depositTokenCalled, 'blockchain.depositToken() should not be called');
        assert.isFalse(increaseBiddingApprovalCalled, 'blockchain.increaseBiddingApproval() should not be called');
        assert.isTrue(createOfferCalled, 'blockchain.createOfferCalled() should be called');
        assert.isTrue(biddingStartedCalled, 'remoteControl.biddingStartedCalled() should be called');

        const updatedOffer = await models.offers.findOne({ where: { id: insertedOfferId } });
        assert.equal(updatedOffer.status, 'STARTED', 'offer.status should be in STARTED state');
    });

    afterEach('Drop DB', async () => {
        if (systemDb) {
            const listOfDatabases = await systemDb.listDatabases();
            if (listOfDatabases.includes(databaseName)) {
                await systemDb.dropDatabase(databaseName);
            }
        }

        // reseting shared indicators
        initializingOfferCalled = false;
        getProfileCalled = false;
        getReplicationModifierCalled = false;
        depositTokenCalled = false;
        increaseBiddingApprovalCalled = false;
        createOfferCalled = false;
        biddingStartedCalled = false;
    });
});
