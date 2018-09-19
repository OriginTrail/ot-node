/* eslint-disable max-len */
const {
    describe, beforeEach, afterEach, it,
} = require('mocha');
const { assert } = require('chai');
const DCOfferFinalizedCommand = require('../../../../modules/command/dc/dc-offer-finalized-command');
const models = require('../../../../models');
const Storage = require('../../../../modules/Storage');
const BN = require('bn.js');
const sleep = require('sleep-async')().Promise;
const Utilities = require('../../../../modules/Utilities');
const { Database } = require('arangojs');
const CommandResolver = require('../../../../modules/command/command-resolver');
const awilix = require('awilix');

const logger = Utilities.getLogger();

describe.only('Checks DCOfferFinalizedCommand execute() logic', function () {
    this.timeout(7000);
    let systemDb;
    let container;
    let dcOfferFinalizedCommand;
    let myCommand;
    let insertedOfferId;
    let bidChosenCalled = false;
    let offerFinalizedCalled = false;


    const databaseName = 'dc_offer_create_db';

    class MockRemoteControl {
        bidChosen(importId) {
            bidChosenCalled = true;
            return importId;
        }
        offerFinalized(message, importId) {
            offerFinalizedCalled = true;
            return importId;
        }
    }

    beforeEach('Inject offer into system database', async () => {
        Storage.models = (await models.sequelize.sync()).models;
        Storage.db = models.sequelize;

        // make sure offers table is cleaned up
        await models.offers.destroy({
            where: {},
            truncate: true,
        });
        await sleep.sleep(1000);

        // make sure events table is cleaned up
        await models.events.destroy({
            where: {},
            truncate: true,
        });

        // allow some time for tables to be deleted from system.db
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

        myCommand = {
            data: {
                importId: Utilities.getRandomIntRange(10, 100),
                offerId: 0, // to be updated once row is injected into db
            },
        };

        let newOfferRow = {
            import_id: myCommand.data.importId,
            total_escrow_time: (new BN(1440, 10)).toString(),
            max_token_amount: (new BN(50000, 10)).toString(),
            min_stake_amount: 1000,
            min_reputation: 0,
            data_hash: '0xfe109af514aef462b86a02e032d1add2ce59a224cd095aa87716b1ad26aa08ca',
            data_size_bytes: (new BN(13404, 10)).toString(),
            dh_wallets: [],
            dh_ids: [],
            message: 'FINALIZING',
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

        const newEventsRow = {
            contract: 'BIDDING_CONTRACT',
            event: 'OfferFinalized',
            data: `{"0":"0xf6d7a8ff15bd55f34f4585843d349538f82648d0df93eea5c83f34000b43b791","import_id": ${myCommand.data.importId}}`,
            block: 3014975,
            import_id: myCommand.data.importId.toString(),
            finished: false,
            timestamp: Date.now(),
        };

        await models.events.create(newEventsRow, {})
            .then((response) => {
            // all good here
            })
            .catch((error) => {
                console.log(error);
            });
        await sleep.sleep(1000);


        container = awilix.createContainer({
            injectionMode: awilix.InjectionMode.PROXY,
        });
    });

    it('finished and finalized properties check', async () => {
        container.register({
            logger: awilix.asValue(logger),
            config: awilix.asValue(Utilities.loadConfig()),
            remoteControl: awilix.asClass(MockRemoteControl),
            commandResolver: awilix.asClass(CommandResolver),
            dcOfferFinalizedCommand: awilix.asClass(DCOfferFinalizedCommand),

        });

        dcOfferFinalizedCommand = await container.resolve('dcOfferFinalizedCommand');

        // call command's execute function
        dcOfferFinalizedCommand.execute(myCommand);
        // allow some time for offer and events to be updated in system.db
        await sleep.sleep(1000);

        assert.isTrue(bidChosenCalled, 'remoteControl.bidChosen() should be called');
        assert.isTrue(offerFinalizedCalled, 'remoteControl.offerFinalized() should be called');

        // lets find the only entry in events we have
        const updatedEvent = await models.events.findOne({ where: { event: 'OfferFinalized' } });
        assert.equal(updatedEvent.finished, '1', 'finished field should been updated to true');

        const updatedOffer = await models.offers.findOne({ where: { id: insertedOfferId } });
        assert.equal(updatedOffer.status, 'FINALIZED', 'offer.status should be in FINALIZED state');
        assert.isTrue((updatedOffer.message).indexOf('finalized') >= 0, 'message should include string finalized');
    });

    afterEach('Drop DB', async () => {
        if (systemDb) {
            const listOfDatabases = await systemDb.listDatabases();
            if (listOfDatabases.includes(databaseName)) {
                await systemDb.dropDatabase(databaseName);
            }
        }
    });
});
