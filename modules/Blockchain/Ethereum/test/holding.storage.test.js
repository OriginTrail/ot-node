var BN = require('bn.js'); // eslint-disable-line no-undef
const { assert, expect } = require('chai');

var TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef
var TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef

var Hub = artifacts.require('Hub'); // eslint-disable-line no-undef

var Profile = artifacts.require('Profile'); // eslint-disable-line no-undef
var Holding = artifacts.require('Holding'); // eslint-disable-line no-undef

var ProfileStorage = artifacts.require('ProfileStorage'); // eslint-disable-line no-undef
var HoldingStorage = artifacts.require('HoldingStorage'); // eslint-disable-line no-undef
var Reading = artifacts.require('Reading'); // eslint-disable-line no-undef

// Helper variables
var DC_wallet;
const emptyHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
const emptyAddress = '0x0000000000000000000000000000000000000000';

// Offer variables
const offerId = '0x0000000000000000000000000000000000000000000000000000000000000000';
const dataSetId = '0x8cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const task = '0x8c1729402acd39d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const difficulty = new BN(45201);
const dataRootHash = '0x1cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const redLitigationHash = '0x2cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const greenLitigationHash = '0x3cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const blueLitigationHash = '0x4cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const dcNodeId = '0x5cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const startTime = new BN(89210421);
const holdingTimeInMinutes = new BN(1);
const tokenAmountPerHolder = new BN(1200);
const dataSetSizeInBytes = new BN(1024);
const litigationIntervalInMinutes = new BN(10);

// Contracts used in test
var hub;
var holding;
var holdingStorage;

// Profile variables
var identities = [];

// eslint-disable-next-line no-undef
contract('Holding storage testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    before(async () => {
        // Get contracts used in hook
        hub = await Hub.deployed();
        holding = await Holding.deployed();
        holdingStorage = await HoldingStorage.deployed();

        // Set accounts[0] as holding contract so it can execute functions
        await hub.setHoldingAddress(accounts[0]);

        DC_wallet = accounts[accounts.length - 1];
    });

    // eslint-disable-next-line no-undef
    after(async () => {
        // Revert Holding contract address in hub contract
        await hub.setHoldingAddress(holding.address);
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer creator', async () => {
        const initialOfferCreator = await holdingStorage.getOfferCreator.call(offerId);

        assert.equal(initialOfferCreator, emptyAddress, 'Initial offer creator in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferCreator(offerId, DC_wallet);

        const offerCreator = await holdingStorage.getOfferCreator.call(offerId);

        assert.equal(offerCreator, DC_wallet, 'Incorrect offer creator written in Holding storage!');
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer dataSetId', async () => {
        const initialDataSetId = await holdingStorage.getOfferDataSetId.call(offerId);

        assert.equal(initialDataSetId, emptyHash, 'Initial dataSetId in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferDataSetId(offerId, dataSetId);

        const newDataSetId = await holdingStorage.getOfferDataSetId.call(offerId);

        assert.equal(newDataSetId, dataSetId, 'Incorrect dataSet ID written in Holding storage!');
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer holding time', async () => {
        const initialHoldingTimeInMinutes =
            await holdingStorage.getOfferHoldingTimeInMinutes.call(offerId);

        assert(initialHoldingTimeInMinutes.isZero(), 'Initial holdingTimeInMinutes in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferHoldingTimeInMinutes(offerId, holdingTimeInMinutes);

        const newHoldingTimeInMinutes =
            await holdingStorage.getOfferHoldingTimeInMinutes.call(offerId);

        assert(newHoldingTimeInMinutes.eq(holdingTimeInMinutes), 'Incorrect holding time written in Holding storage!');
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer token amount per holder', async () => {
        const initialTokenAmountPerHolder =
            await holdingStorage.getOfferTokenAmountPerHolder.call(offerId);

        assert(initialTokenAmountPerHolder.isZero(), 'Initial tokenAmountPerHolder in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferTokenAmountPerHolder(offerId, tokenAmountPerHolder);

        const newTokenAmountPerHolder =
            await holdingStorage.getOfferTokenAmountPerHolder.call(offerId);

        assert(
            newTokenAmountPerHolder.eq(tokenAmountPerHolder),
            `Incorrect token amount per holder written in Holding storage, got ${newTokenAmountPerHolder} instead of ${tokenAmountPerHolder}!`,
        );
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer task', async () => {
        const initialTask =
            await holdingStorage.getOfferTask.call(offerId);

        assert.equal(initialTask, emptyHash, 'Initial task in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferTask(offerId, task);

        const newTask =
            await holdingStorage.getOfferTask.call(offerId);

        assert.equal(newTask, task, 'Incorrect task written in Holding storage!');
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer difficulty', async () => {
        const initialDifficulty =
            await holdingStorage.getOfferDifficulty.call(offerId);

        assert(initialDifficulty.isZero(), 'Initial difficulty in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferDifficulty(offerId, difficulty);

        const newDifficulty =
            await holdingStorage.getOfferDifficulty.call(offerId);

        assert(
            newDifficulty.eq(difficulty),
            `Incorrect difficulty written in Holding storage, got ${newDifficulty} instead of ${difficulty}!`,
        );
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer redLitigationHash', async () => {
        const initialRedLitigationHash =
            await holdingStorage.getOfferRedLitigationHash.call(offerId);

        assert.equal(initialRedLitigationHash, emptyHash, 'Initial redLitigationHash in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferRedLitigationHash(offerId, redLitigationHash);

        const newRedLitigationHash =
            await holdingStorage.getOfferRedLitigationHash.call(offerId);

        assert.equal(newRedLitigationHash, redLitigationHash, 'Incorrect redLitigationHash written in Holding storage!');
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer greenLitigationHash', async () => {
        const initialGreenLitigationHash =
            await holdingStorage.getOfferGreenLitigationHash.call(offerId);

        assert.equal(initialGreenLitigationHash, emptyHash, 'Initial greenLitigationHash in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferGreenLitigationHash(offerId, greenLitigationHash);

        const newGreenLitigationHash =
            await holdingStorage.getOfferGreenLitigationHash.call(offerId);

        assert.equal(newGreenLitigationHash, greenLitigationHash, 'Incorrect greenLitigationHash written in Holding storage!');
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer blueLitigationHash', async () => {
        const initialBlueLitigationHash =
            await holdingStorage.getOfferBlueLitigationHash.call(offerId);

        assert.equal(initialBlueLitigationHash, emptyHash, 'Initial blueLitigationHash in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferBlueLitigationHash(offerId, blueLitigationHash);

        const newBlueLitigationHash =
            await holdingStorage.getOfferBlueLitigationHash.call(offerId);

        assert.equal(newBlueLitigationHash, blueLitigationHash, 'Incorrect blueLitigationHash written in Holding storage!');
    });

    // eslint-disable-next-line no-undef
    it('Should set and get offer start time', async () => {
        const initialStartTime =
            await holdingStorage.getOfferStartTime.call(offerId);

        assert(initialStartTime.isZero(), 'Initial start time in Holding storage must be 0!');

        // Execute tested function
        await holdingStorage.setOfferStartTime(offerId, startTime);

        const newStartTime =
            await holdingStorage.getOfferStartTime.call(offerId);

        assert(
            newStartTime.eq(startTime),
            `Incorrect start time written in Holding storage, got ${newStartTime} instead of ${startTime}!`,
        );
    });

    // eslint-disable-next-line no-undef
    it('Should reset all offer variables using multiple setter functions', async () => {
        const initialOffer =
            await holdingStorage.offer.call(offerId);

        assert.equal(initialOffer.creator, DC_wallet, 'Incorrect offer creator written in Holding storage!');
        assert.equal(initialOffer.dataSetId, dataSetId, 'Incorrect dataSet ID written in Holding storage!');
        assert(initialOffer.holdingTimeInMinutes.eq(holdingTimeInMinutes), 'Incorrect holding time written in Holding storage!');
        assert(
            initialOffer.tokenAmountPerHolder.eq(tokenAmountPerHolder),
            `Incorrect token amount per holder written in Holding storage, got ${initialOffer.tokenAmountPerHolder.toString()} instead of ${tokenAmountPerHolder.toString()}!`,
        );
        assert.equal(initialOffer.task, task, 'Incorrect task written in Holding storage!');
        assert(
            initialOffer.difficulty.eq(difficulty),
            `Incorrect difficulty written in Holding storage, got ${initialOffer.difficulty.toString()} instead of ${difficulty.toString()}!`,
        );
        assert.equal(initialOffer.redLitigationHash, redLitigationHash, 'Incorrect redLitigationHash written in Holding storage!');
        assert.equal(initialOffer.greenLitigationHash, greenLitigationHash, 'Incorrect greenLitigationHash written in Holding storage!');
        assert.equal(initialOffer.blueLitigationHash, blueLitigationHash, 'Incorrect blueLitigationHash written in Holding storage!');
        assert(
            initialOffer.startTime.eq(startTime),
            `Incorrect start time written in Holding storage, got ${initialOffer.startTime.toString()} instead of ${startTime.toString()}!`,
        );

        // Execute tested function
        await holdingStorage.setOfferParameters(
            offerId,
            emptyAddress, // offerCreator
            emptyHash, // dataSetId
            new BN(0), // holdingTimeInMinutes
            new BN(0), // tokenAmountPerHolder
            emptyHash, // task
            new BN(0), // difficulty
        );
        await holdingStorage.setOfferLitigationHashes(
            offerId,
            emptyHash, // redLitigationHash
            emptyHash, // greenLitigationHash
            emptyHash, // blueLitigationHash
        );
        await holdingStorage.setOfferStartTime(
            offerId,
            new BN(0),
        );

        const finalOffer =
            await holdingStorage.offer.call(offerId);

        assert.equal(finalOffer.creator, emptyAddress, 'Final offer creator in Holding storage must be 0!');
        assert.equal(finalOffer.dataSetId, emptyHash, 'Final dataSetId in Holding storage must be 0!');
        assert(finalOffer.holdingTimeInMinutes.isZero(), 'Final holdingTimeInMinutes in Holding storage must be 0!');
        assert(finalOffer.tokenAmountPerHolder.isZero(), 'Final tokenAmountPerHolder in Holding storage must be 0!');
        assert.equal(finalOffer.task, emptyHash, 'Final task in Holding storage must be 0!');
        assert(finalOffer.difficulty.isZero(), 'Final difficulty in Holding storage must be 0!');
        assert.equal(finalOffer.redLitigationHash, emptyHash, 'Final redLitigationHash in Holding storage must be 0!');
        assert.equal(finalOffer.greenLitigationHash, emptyHash, 'Final greenLitigationHash in Holding storage must be 0!');
        assert.equal(finalOffer.blueLitigationHash, emptyHash, 'Final blueLitigationHash in Holding storage must be 0!');
        assert(finalOffer.startTime.isZero(), 'Final start time in Holding storage must be 0!');
    });
});
