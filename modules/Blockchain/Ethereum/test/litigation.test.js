var BN = require('bn.js'); // eslint-disable-line no-undef
const { assert, expect } = require('chai');

const TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef
const TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef

const Hub = artifacts.require('Hub'); // eslint-disable-line no-undef

const Profile = artifacts.require('Profile'); // eslint-disable-line no-undef
const Holding = artifacts.require('Holding'); // eslint-disable-line no-undef
const Litigation = artifacts.require('Litigation'); // eslint-disable-line no-undef
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
var DC_wallet;
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
        const solution = await util.keccakAddressAddressAddress.call(
            identities[0],
            identities[1],
            identities[2],
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
            promises[i] = await util.keccakBytesAddress.call(offerId, identities[i]);
        }
        confirmations = await Promise.all(promises);

        // Signing calculated confirmations
        promises = [];
        for (let i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = await web3.eth.accounts.sign(confirmations[i], privateKeys[i]);
        }
        const signedConfirmations = await Promise.all(promises);

        await holding.finalizeOffer(
            DC_identity,
            offerId,
            shift,
            signedConfirmations[0].signature,
            signedConfirmations[1].signature,
            signedConfirmations[2].signature,
            [new BN(0), new BN(1), new BN(2)],
            [identities[0], identities[1], identities[2]],
            { from: DC_wallet },
        );
    });

    // eslint-disable-next-line no-undef
    it('Challenge and replace an unresponsive DH', async () => {
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
        console.log(`\t Gas used for initiating litigation: ${res.receipt.gasUsed}`);

        // Instead of answering litigation
        // move the litigation timestamp in order to simulate lack of answer
        let timestamp = await litigationStorage.getLitigationTimestamp.call(offerId, identities[0]);
        timestamp = timestamp.sub(new BN(100));
        await litigationStorage.setLitigationTimestamp(offerId, identities[0], timestamp);

        // Complete litigation
        res = await litigation.completeLitigation(
            offerId,
            identities[0],
            DC_identity,
            hashes[0],
            { from: DC_wallet, gasLimit: 6000000 },
        );

        const task = await litigationStorage.litigation.call(offerId, identities[0]);
        const solution = await util.keccakAddressAddressAddress.call(
            identities[3],
            identities[4],
            identities[5],
        );

        let i = 0;
        // Calculate task solution
        for (i = 65; i >= 2; i -= 1) {
            if (task.replacementTask.charAt(task.replacementTask.length - 1)
                === solution.charAt(i)) break;
        }
        if (i === 2) {
            assert(false, 'Could not find solution for offer challenge!');
        }
        const shift = 65 - i;

        // Calculating confirmations to be signed by DH's
        var confirmations = [];
        let promises = [];
        for (let i = 3; i < 6; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = await util.keccakBytesAddress.call(offerId, identities[i]);
        }
        confirmations = await Promise.all(promises);

        // Signing calculated confirmations
        promises = [];
        for (let i = 3; i < 6; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            promises[i] = await web3.eth.accounts.sign(confirmations[i], privateKeys[i]);
        }
        const signedConfirmations = await Promise.all(promises);

        const replacementHolderIdentities = [
            identities[3],
            identities[4],
            identities[5],
        ];

        res = await litigation.replaceHolder(
            offerId,
            identities[0],
            DC_identity,
            shift,
            signedConfirmations[3].signature,
            signedConfirmations[4].signature,
            signedConfirmations[5].signature,
            replacementHolderIdentities,
            { from: DC_wallet },
        );
    });
    // eslint-disable-next-line no-undef
    it('Litigation completion should block DH from payout', async () => {
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
        console.log(`\t Gas used for initiating litigation: ${res.receipt.gasUsed}`);

        // Instead of answering litigation
        // move the litigation timestamp in order to simulate lack of answer
        let timestamp = await litigationStorage.getLitigationTimestamp.call(offerId, identities[0]);
        timestamp = timestamp.sub(new BN(100));
        await litigationStorage.setLitigationTimestamp(offerId, identities[0], timestamp);

        // Complete litigation
        await litigation.completeLitigation(
            offerId,
            identities[0],
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
});
