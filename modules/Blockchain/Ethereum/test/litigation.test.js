var BN = require('bn.js'); // eslint-disable-line no-undef
const { assert, expect } = require('chai');

const TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef
const TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef

const Hub = artifacts.require('Hub'); // eslint-disable-line no-undef

const Profile = artifacts.require('Profile'); // eslint-disable-line no-undef
const Holding = artifacts.require('Holding'); // eslint-disable-line no-undef
const Litigation = artifacts.require('Litigation'); // eslint-disable-line no-undef
const Replacement = artifacts.require('Replacement'); // eslint-disable-line no-undef
const MockLitigation = artifacts.require('MockLitigation'); // eslint-disable-line no-undef

const ProfileStorage = artifacts.require('ProfileStorage'); // eslint-disable-line no-undef
const HoldingStorage = artifacts.require('HoldingStorage'); // eslint-disable-line no-undef
const LitigationStorage = artifacts.require('LitigationStorage'); // eslint-disable-line no-undef
const Reading = artifacts.require('Reading'); // eslint-disable-line no-undef

const Identity = artifacts.require('Identity'); // eslint-disable-line no-undef

var Web3 = require('web3');

var web3;

var Ganache = require('ganache-core');

// Helper variables
var errored = true;
var DC_identity;
var DH_identity;
var DC_wallet;
var DH_wallet;
var offerId;
var tokensToDeposit = (new BN(5)).mul(new BN(10).pow(new BN(21)));

// Variables used for litigation
const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const requested_data_index = 5;
var requested_data = [];
var hashes = [];
var hash_AB;
var hash_CD;
var hash_EF;
var hash_GH;
var hash_ABCD;
var hash_EFGH;
var root_hash;

// Offer variables
const dataSetId = '0x8cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const dataRootHash = '0x1cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const redLitigationHash = '0x2cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const greenLitigationHash = '0x3cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const blueLitigationHash = '0x4cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const dcNodeId = '0x5cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const holdingTimeInMinutes = new BN(1);
const tokenAmountPerHolder = new BN(120);
const dataSetSizeInBytes = new BN(1024);
const litigationIntervalInMinutes = new BN(1);

// Profile variables
var privateKeys = [];
var identities = [];

// Contracts used in test
var trac;
var profile;
var holding;
var litigation;
var replacement;
var holdingStorage;
var profileStorage;
var litigationStorage;
var util;

// eslint-disable-next-line no-undef
contract('Litigation testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    before(async () => {
        // Get contracts used in hook
        trac = await TracToken.deployed();
        profile = await Profile.deployed();
        holding = await Holding.deployed();
        litigation = await Litigation.deployed();
        replacement = await Replacement.deployed();
        holdingStorage = await HoldingStorage.deployed();
        profileStorage = await ProfileStorage.deployed();
        litigationStorage = await LitigationStorage.deployed();
        util = await TestingUtilities.deployed();

        privateKeys = [
            '0x02b39cac1532bef9dba3e36ec32d3de1e9a88f1dda597d3ac6e2130aed9adc4e',
            '0xb1c53fd90d0172ff60f14f61f7a09555a9b18aa3c371991d77209cfe524e71e6',
            '0x8ab3477bf3a1e0af66ab468fafd6cf982df99a59fee405d99861e7faf4db1f7b',
            '0xc80796c049af64d07c76ab4cfb00655895368c60e50499e56cdc3c38d09aa88e',
            '0x239d785cea7e22f23d1fa0f22a7cb46c04d81498ce4f2de07a9d2a7ceee45004',
            '0x021336479aa1553e42bfcd3b928dee791db84a227906cb7cec5982d382ecf106',
            '0x217479bee25ed6d28302caec069c7297d0c3aefdda81cf91ed754c4d660862ae',
            '0xa050f7b3a0479a55e9ddd074d218fbfea302f061e9f21a117a2ec1f0b986a363',
            '0x0dbaee2066aacd16d43a9e23649f232913bca244369463320610ffe6ffb0d69d',
            '0x63b854ff0d973dbd4808a6def4c6a7f65bebcaec07520fbf1c0056331af65a7b',
        ];


        // Generate web3 and set provider
        web3 = new Web3('HTTP://127.0.0.1:7545');
        web3.setProvider(Ganache.provider());

        // Generate eth_account, identities, and profiles

        // Increase approval for depositing tokens
        var promises = [];
        for (let i = 0; i < accounts.length; i += 1) {
            promises[i] = trac.increaseApproval(
                profile.address,
                tokensToDeposit,
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);

        var res;
        // Generate profiles
        for (let i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            res = await profile.createProfile(
                accounts[i],
                accounts[i],
                tokensToDeposit,
                false,
                '0x7e9f99b7971cb3de779690a82fec5e2ceec74dd0',
                { from: accounts[i] },
            );
            identities[i] = res.logs[0].args.newIdentity;
        }

        DC_wallet = accounts[accounts.length - 1];
        DC_identity = identities[identities.length - 1];

        // eslint-disable-next-line prefer-destructuring
        DH_wallet = accounts[0];
        // eslint-disable-next-line prefer-destructuring
        DH_identity = identities[0];
    });

    // eslint-disable-next-line no-undef
    beforeEach(async () => {
        // Create an offer used for testing the litigation process

        // Calculate litigation root hash
        // Merkle tree structure
        /*      / \
               /   \
              /     \
             /       \
            /         \
           / \       / \
          /   \     /   \
         /\   /\   /\   /\
        A  B C  D E  F G  H  */

        // Calculating hashes of requested data
        let promises = [];
        for (let i = 0; i < 8; i += 1) {
            promises[i] = util.keccakString.call(letters[i]);
        }
        requested_data = await Promise.all(promises);

        // Calculating indexed hashes of requested data
        promises = [];
        for (let i = 0; i < 8; i += 1) {
            promises[i] = util.keccakIndex.call(requested_data[i], i);
        }
        hashes = await Promise.all(promises);

        // Creating merkle tree
        hash_AB = await util.keccak2hashes.call(hashes[0], hashes[1]);
        hash_CD = await util.keccak2hashes.call(hashes[2], hashes[3]);
        hash_EF = await util.keccak2hashes.call(hashes[4], hashes[5]);
        hash_GH = await util.keccak2hashes.call(hashes[6], hashes[7]);
        hash_ABCD = await util.keccak2hashes.call(hash_AB, hash_CD);
        hash_EFGH = await util.keccak2hashes.call(hash_EF, hash_GH);
        root_hash = await util.keccak2hashes.call(hash_ABCD, hash_EFGH);


        // Creating offer used for litigation
        const res = await holding.createOffer(
            DC_identity,
            dataSetId,
            dataRootHash,
            root_hash, // Use root hash as all 3 colors for easier testing
            root_hash,
            root_hash,
            dcNodeId,
            holdingTimeInMinutes,
            tokenAmountPerHolder,
            dataSetSizeInBytes,
            litigationIntervalInMinutes,
            { from: DC_wallet },
        );
        // eslint-disable-next-line prefer-destructuring
        offerId = res.logs[0].args.offerId;
        const task = await holdingStorage.getOfferTask.call(offerId);

        const hash1 = await util.keccakAddressBytes(identities[0], task);
        const hash2 = await util.keccakAddressBytes(identities[1], task);
        const hash3 = await util.keccakAddressBytes(identities[2], task);

        const sortedIdentities = [
            {
                identity: identities[0],
                privateKey: privateKeys[0],
                hash: hash1,
            },
            {
                identity: identities[1],
                privateKey: privateKeys[1],
                hash: hash2,
            },
            {
                identity: identities[2],
                privateKey: privateKeys[2],
                hash: hash3,
            },
        ].sort((x, y) => x.hash.localeCompare(y.hash));

        const solution = await util.keccakBytesBytesBytes.call(
            sortedIdentities[0].hash,
            sortedIdentities[1].hash,
            sortedIdentities[2].hash,
        );

        // Calculate task solution
        for (var i = 65; i >= 2; i -= 1) {
            if (task.charAt(task.length - 1) === solution.charAt(i)) break;
        }
        if (i === 2) {
            assert(false, 'Could not find solution for offer challenge!');
        }
        const shift = 65 - i;

        // Calculating confirmations to be signed by DH's
        var confirmations = [];
        promises = [];
        for (let i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = await util.keccakBytesAddress.call(offerId, sortedIdentities[i].identity);
        }
        confirmations = await Promise.all(promises);

        // Signing calculated confirmations
        promises = [];
        for (let i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = web3.eth.accounts.sign(
                confirmations[i],
                sortedIdentities[i].privateKey,
            );
        }
        const signedConfirmations = await Promise.all(promises);

        await holding.finalizeOffer(
            DC_identity,
            offerId,
            shift,
            signedConfirmations[0].signature,
            signedConfirmations[1].signature,
            signedConfirmations[2].signature,
            [new BN(2), new BN(2), new BN(2)],
            [
                sortedIdentities[0].identity,
                sortedIdentities[1].identity,
                sortedIdentities[2].identity,
            ],
            { from: DC_wallet },
        );
    });


    // eslint-disable-next-line no-undef
    it('Challenge and replace an unresponsive DH', async () => {
        // Get initial litigation values
        const initialLitigationState =
            await litigationStorage.litigation.call(offerId, DH_identity);
        const initialOfferState = await holdingStorage.offer.call(offerId);
        const initialDhProfileState = await profileStorage.profile.call(DH_identity);
        const initialDhHolderState = await holdingStorage.holder.call(offerId, DH_identity);
        const initialDcState = await profileStorage.profile.call(DC_identity);

        assert(
            initialLitigationState.status.isZero(),
            `Initial litigation status differs from expected! Got ${initialLitigationState.status.toString()} but expected 0!`,
        );
        assert(
            initialLitigationState.timestamp.isZero(),
            `Initial litigation timestamp differs from expected! Got ${initialLitigationState.timestamp.toString()} but expected 0!`,
        );
        assert(
            initialDhHolderState.stakedAmount.eq(initialOfferState.tokenAmountPerHolder),
            `Initial holder staked amount differs from expected! Got ${initialDhHolderState.stakedAmount.toString()} but expected ${initialOfferState.tokenAmountPerHolder.toString()}!`,
        );
        assert(
            initialDhHolderState.paidAmount.isZero(),
            `Initial litigation status differs from expected! Got ${initialDhHolderState.paidAmount.toString()} but expected 0!`,
        );
        assert(
            initialDhHolderState.paymentTimestamp.eq(initialOfferState.startTime),
            `Initial payment timestamp differs from expected! Got ${initialDhHolderState.paymentTimestamp.toString()} but expected ${initialOfferState.startTime.toString()}!`,
        );

        // Move offer half way through
        let timestamp = initialOfferState.startTime;
        timestamp = timestamp.sub(holdingTimeInMinutes.muln(60).divn(2));
        await holdingStorage.setOfferStartTime(offerId, timestamp);
        await holdingStorage.setHolderPaymentTimestamp(offerId, DH_identity, timestamp);

        // Initiate litigation
        let res = await litigation.initiateLitigation(
            offerId,
            DH_identity,
            DC_identity,
            new BN(0),
            [hashes[1], hash_CD, hash_EFGH],
            { from: DC_wallet },
        );

        // Instead of answering litigation
        // move the litigation timestamp in order to simulate lack of answer
        timestamp = await litigationStorage.getLitigationTimestamp.call(offerId, DH_identity);
        timestamp = timestamp.sub(litigationIntervalInMinutes.muln(60).addn(1));
        await litigationStorage.setLitigationTimestamp(offerId, DH_identity, timestamp);
        timestamp = await holdingStorage.getOfferStartTime.call(offerId);
        timestamp = timestamp.sub(litigationIntervalInMinutes.muln(60).addn(1));
        await holdingStorage.setOfferStartTime(offerId, timestamp);
        await holdingStorage.setHolderPaymentTimestamp(offerId, DH_identity, timestamp);

        // Complete litigation
        res = await litigation.completeLitigation(
            offerId,
            DH_identity,
            DC_identity,
            hashes[0],
            { from: DC_wallet, gasLimit: 6000000 },
        );

        // Get holder paid amount
        const holderPaidAmount =
            await holdingStorage.getHolderPaidAmount.call(offerId, DH_identity);
        assert(
            holderPaidAmount.gt(tokenAmountPerHolder.divn(2).subn(5)) &&
                holderPaidAmount.lt(tokenAmountPerHolder.divn(2).addn(5)),
            'Incorrect paid amount for DH after litigation completion!' +
            ` Got ${res.toString()} but expected ${tokenAmountPerHolder.divn(2).toString()}`,
        );

        const task = (await litigationStorage.litigation.call(
            offerId,
            DH_identity,
        )).replacementTask;

        const hash1 = await util.keccakAddressBytes(identities[3], task);
        const hash2 = await util.keccakAddressBytes(identities[4], task);
        const hash3 = await util.keccakAddressBytes(identities[5], task);

        const sortedIdentities = [
            {
                identity: identities[3],
                privateKey: privateKeys[3],
                hash: hash1,
            },
            {
                identity: identities[4],
                privateKey: privateKeys[4],
                hash: hash2,
            },
            {
                identity: identities[5],
                privateKey: privateKeys[5],
                hash: hash3,
            },
        ].sort((x, y) => x.hash.localeCompare(y.hash));

        const solution = await util.keccakBytesBytesBytes.call(
            sortedIdentities[0].hash,
            sortedIdentities[1].hash,
            sortedIdentities[2].hash,
        );

        let i = 0;
        // Calculate task solution
        for (i = 65; i >= 2; i -= 1) {
            if (task.charAt(task.length - 1)
                === solution.charAt(i)) break;
        }
        if (i === 2) {
            assert(false, 'Could not find solution for offer challenge!');
        }
        const shift = 65 - i;

        // Calculating confirmations to be signed by DH's
        var confirmations = [];
        let promises = [];
        for (let i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = util.keccakBytesAddress.call(offerId, sortedIdentities[i].identity);
        }
        confirmations = await Promise.all(promises);

        // Signing calculated confirmations
        promises = [];
        for (let i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = web3.eth.accounts.sign(
                confirmations[i],
                sortedIdentities[i].privateKey,
            );
        }
        const signedConfirmations = await Promise.all(promises);

        res = await replacement.replaceHolder(
            offerId,
            DH_identity,
            DC_identity,
            shift,
            signedConfirmations[0].signature,
            signedConfirmations[1].signature,
            signedConfirmations[2].signature,
            [
                sortedIdentities[0].identity,
                sortedIdentities[1].identity,
                sortedIdentities[2].identity,
            ],
            { from: DC_wallet },
        );

        // eslint-disable-next-line arrow-body-style
        const replacementDH = res.logs.find((element) => {
            return element.event === 'ReplacementCompleted';
        }).args.chosenHolder;

        const replacementDHState = await holdingStorage.holder(offerId, replacementDH);
        assert(
            replacementDHState.stakedAmount.eq(tokenAmountPerHolder.sub(holderPaidAmount)),
            'Replacement holder staked amount not matching! ' +
            `Got ${replacementDHState.stakedAmount.toString()} ` +
            `but expected ${tokenAmountPerHolder.sub(holderPaidAmount).toString()}`,
        );

        const finalLitigationState = await litigationStorage.litigation.call(offerId, DH_identity);
        const replacementLitigationState =
            await litigationStorage.litigation.call(offerId, replacementDH);
        const finalOfferState = await holdingStorage.offer.call(offerId);
        const finalDhProfileState = await profileStorage.profile.call(DH_identity);
        const finalDhHolderState = await holdingStorage.holder.call(offerId, DH_identity);
        const finalDcState = await profileStorage.profile.call(DC_identity);

        assert(
            replacementLitigationState.status.eq(new BN(0)),
            `Final litigation status differs from expected! Got ${replacementLitigationState.status.toString()} but expected 0!`,
        );
        assert(
            finalLitigationState.status.eq(new BN(4)),
            `Final litigation status differs from expected! Got ${finalLitigationState.status.toString()} but expected 4!`,
        );
        assert(
            replacementLitigationState.timestamp.isZero(),
            `Replacement litigation timestamp differs from expected! Got ${replacementLitigationState.timestamp.toString()} but expected 0!`,
        );
        assert(
            finalDhHolderState.stakedAmount.eq(initialOfferState.tokenAmountPerHolder),
            `Initial holder staked amount differs from expected! Got ${finalDhHolderState.stakedAmount.toString()} but expected ${initialOfferState.tokenAmountPerHolder.toString()}!`,
        );
    });

    // eslint-disable-next-line no-undef
    it('Litigation completion should block DH from payout', async () => {
        // Get initial litigation values
        let res = await litigationStorage.litigation.call(offerId, identities[0]);

        // Move offer half way through
        let timestamp = await holdingStorage.getOfferStartTime.call(offerId);
        timestamp = timestamp.sub(holdingTimeInMinutes.muln(60).divn(2));
        await holdingStorage.setOfferStartTime(offerId, timestamp);
        await holdingStorage.setHolderPaymentTimestamp(offerId, DH_identity, timestamp);

        // Initiate litigation
        res = await litigation.initiateLitigation(
            offerId,
            DH_identity,
            DC_identity,
            new BN(0),
            [hashes[1], hash_CD, hash_EFGH],
            { from: DC_wallet },
        );

        // Instead of answering litigation
        // move the litigation timestamp in order to simulate lack of answer
        timestamp = await litigationStorage.getLitigationTimestamp.call(offerId, DH_identity);
        timestamp = timestamp.sub(litigationIntervalInMinutes.muln(60).addn(1));
        await litigationStorage.setLitigationTimestamp(offerId, DH_identity, timestamp);
        timestamp = await holdingStorage.getOfferStartTime.call(offerId);
        timestamp = timestamp.sub(litigationIntervalInMinutes.muln(60).addn(1));
        await holdingStorage.setOfferStartTime(offerId, timestamp);
        await holdingStorage.setHolderPaymentTimestamp(offerId, DH_identity, timestamp);

        // Complete litigation
        await litigation.completeLitigation(
            offerId,
            DH_identity,
            DC_identity,
            hashes[0],
            { from: DC_wallet, gasLimit: 6000000 },
        );

        let failed = false;
        try {
            await holding.payOut(identities[0], offerId);
        } catch (err) {
            failed = true;
        } finally {
            assert(failed, 'Expected payout to fail');
        }
    });

    // eslint-disable-next-line no-undef
    it('Inactive DC should enable DH to payout some time after answering', async () => {
        // Get initial litigation values
        let res = await litigationStorage.litigation.call(offerId, identities[0]);

        // Initiate litigation
        res = await litigation.initiateLitigation(
            offerId,
            identities[0],
            DC_identity,
            new BN(0),
            [hashes[1], hash_CD, hash_EFGH],
            { from: DC_wallet },
        );

        let timestamp = await holdingStorage.getOfferStartTime.call(offerId);
        timestamp = timestamp.sub(new BN(80));
        await holdingStorage.setOfferStartTime(offerId, timestamp);

        // answerLitigation(bytes32 offerId, address holderIdentity, bytes32 requestedData)
        await litigation.answerLitigation(offerId, identities[0], hashes[0]);

        res = await litigationStorage.litigation.call(offerId, identities[0]);

        // Instead of completing litigation
        // move the litigation timestamp in order to simulate lack of answer
        timestamp = await litigationStorage.getLitigationTimestamp.call(offerId, DH_identity);
        timestamp = timestamp.sub(litigationIntervalInMinutes.muln(60).addn(1));
        await litigationStorage.setLitigationTimestamp(offerId, DH_identity, timestamp);
        timestamp = await holdingStorage.getOfferStartTime.call(offerId);
        timestamp = timestamp.sub(litigationIntervalInMinutes.muln(60).addn(1));
        await holdingStorage.setOfferStartTime(offerId, timestamp);
        await holdingStorage.setHolderPaymentTimestamp(offerId, DH_identity, timestamp);

        let failed = false;
        try {
            await holding.payOut(identities[0], offerId);
        } catch (err) {
            console.log(err);
            failed = true;
        } finally {
            assert(!failed, 'Expected payout failed');
        }
    });

    // eslint-disable-next-line no-undef
    it('Inactive DC should enable DH to payout some time after answering', async () => {
        // Get initial litigation values
        let res = await litigationStorage.litigation.call(offerId, identities[0]);

        // Initiate litigation
        res = await litigation.initiateLitigation(
            offerId,
            identities[0],
            DC_identity,
            new BN(0),
            [hashes[1], hash_CD, hash_EFGH],
            { from: DC_wallet },
        );

        let timestamp = await holdingStorage.getOfferStartTime.call(offerId);
        timestamp = timestamp.sub(new BN(80));
        await holdingStorage.setOfferStartTime(offerId, timestamp);

        // answerLitigation(bytes32 offerId, address holderIdentity, bytes32 requestedData)
        await litigation.answerLitigation(offerId, identities[0], hashes[0]);

        res = await litigationStorage.litigation.call(offerId, identities[0]);

        timestamp = await litigationStorage.getLitigationTimestamp.call(offerId, identities[0]);
        timestamp = timestamp.sub(new BN(80));
        await litigationStorage.setLitigationTimestamp(offerId, identities[0], timestamp);

        let failed = false;
        try {
            await holding.payOut(identities[0], offerId);
        } catch (err) {
            console.log(err);
            failed = true;
        } finally {
            assert(!failed, 'Expected payout failed');
        }
    });

    // eslint-disable-next-line no-undef
    it('should replace 3 new DHs when DC completes and replaces', async () => {
        // Scenario 3.1:
        // DC Completes and replaces DH (result should be 3 new DHs))
        const litigationStatus = {
            completed: '0',
            initiated: '1',
            answered: '2',
            replacing: '3',
            replaced: '4',
        };
        const wrongAnswer = '0xe4805086a97028f6dc0c544612d99b8791131396c62a8a543ee8aa3940f7318a';
        // Get initial litigation values
        await litigationStorage.litigation.call(offerId, identities[0]);

        // Initiate litigation
        await litigation.initiateLitigation(
            offerId,
            identities[0],
            DC_identity,
            new BN(0),
            [hashes[1], hash_CD, hash_EFGH],
            { from: DC_wallet },
        );

        let litigationStruct = await litigationStorage.litigation.call(offerId, identities[0]);
        expect(litigationStruct.status.toString()).to.equal(litigationStatus.initiated);

        // Let the DH answer wrongly.
        await litigation.answerLitigation(offerId, identities[0], wrongAnswer);

        litigationStruct = await litigationStorage.litigation.call(offerId, identities[0]);
        expect(litigationStruct.status.toString()).to.equal(litigationStatus.answered);

        // Complete litigation
        await litigation.completeLitigation(
            offerId,
            identities[0],
            DC_identity,
            requested_data[0],
            { from: DC_wallet, gasLimit: 6000000 },
        );

        litigationStruct = await litigationStorage.litigation.call(offerId, identities[0]);
        expect(litigationStruct.status.toString()).to.equal(litigationStatus.replacing);

        // Start replacement.
        const task = (await litigationStorage.litigation.call(
            offerId,
            DH_identity,
        )).replacementTask;

        const hash1 = await util.keccakAddressBytes(identities[3], task);
        const hash2 = await util.keccakAddressBytes(identities[4], task);
        const hash3 = await util.keccakAddressBytes(identities[5], task);

        const sortedIdentities = [
            {
                identity: identities[3],
                privateKey: privateKeys[3],
                hash: hash1,
            },
            {
                identity: identities[4],
                privateKey: privateKeys[4],
                hash: hash2,
            },
            {
                identity: identities[5],
                privateKey: privateKeys[5],
                hash: hash3,
            },
        ].sort((x, y) => x.hash.localeCompare(y.hash));

        const solution = await util.keccakBytesBytesBytes.call(
            sortedIdentities[0].hash,
            sortedIdentities[1].hash,
            sortedIdentities[2].hash,
        );

        // Calculate task solution
        let i;
        for (i = 65; i >= 2; i -= 1) {
            if (task.charAt(task.length - 1)
                    === solution.charAt(i)) {
                break;
            }
        }
        assert(i !== 2, 'Could not find solution for offer challenge!');
        const shift = 65 - i;

        // Calculating confirmations to be signed by DHs
        let promises = [];
        for (let i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = util.keccakBytesAddress.call(offerId, sortedIdentities[i].identity);
        }
        const confirmations = await Promise.all(promises);

        // Signing calculated confirmations
        promises = [];
        for (let i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = web3.eth.accounts.sign(confirmations[i], sortedIdentities[i].privateKey);
        }
        const signedConfirmations = await Promise.all(promises);

        await replacement.replaceHolder(
            offerId,
            identities[0],
            DC_identity,
            shift,
            signedConfirmations[0].signature,
            signedConfirmations[1].signature,
            signedConfirmations[2].signature,
            [
                sortedIdentities[0].identity,
                sortedIdentities[1].identity,
                sortedIdentities[2].identity,
            ],
            { from: DC_wallet },
        );

        litigationStruct = await litigationStorage.litigation.call(
            offerId,
            identities[0],
        );
        expect(litigationStruct.status.toString()).to.equal(litigationStatus.replaced);
    });
});
