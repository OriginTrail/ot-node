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

var Creditor = artifacts.require('Creditor'); // eslint-disable-line no-undef

var Identity = artifacts.require('Identity'); // eslint-disable-line no-undef

var Web3 = require('web3');

var web3;

var Ganache = require('ganache-core');

// Helper variables
var errored = true;
var DC_identity;
var DC_wallet;
var DC_index;
var offerId;
var tokensToDeposit = (new BN(5)).mul(new BN(10).pow(new BN(20)));

// Offer variables
const dataSetId = '0x8cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const dataRootHash = '0x1cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const redLitigationHash = '0x2cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const greenLitigationHash = '0x3cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const blueLitigationHash = '0x4cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const dcNodeId = '0x5cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';
const holdingTimeInMinutes = new BN(1);
const tokenAmountPerHolder = new BN(1200);
const dataSetSizeInBytes = new BN(1024);
const litigationIntervalInMinutes = new BN(10);

// Profile variables
var privateKeys = [];
var identities = [];

// Contracts used in test
var hub;
var trac;
var profile;
var holding;
var holdingStorage;
var profileStorage;
var util;
var creditorContract;
var creditorWallet;
var creditorIndex;

// eslint-disable-next-line no-undef
contract('Offer tests with creditor', async (accounts) => {
    const initialState = {};
    const finalState = {};
    const delta = {};

    // eslint-disable-next-line no-undef
    before(async () => {
        // Get contracts used in hook
        hub = await Hub.deployed();
        trac = await TracToken.deployed();
        profile = await Profile.deployed();
        holding = await Holding.deployed();
        holdingStorage = await HoldingStorage.deployed();
        profileStorage = await ProfileStorage.deployed();
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
        // ----------------------------------------------

        // Increase approval for depositing tokens
        var promises = [];
        for (var i = 0; i < accounts.length; i += 1) {
            promises[i] = trac.increaseApproval(
                profile.address,
                (new BN(5)).mul(new BN(10).pow(new BN(20))),
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);

        tokensToDeposit = await profile.minimalStake.call();

        var res;
        // Generate profiles
        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            res = await profile.createProfile(
                '0x4cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde',
                tokensToDeposit,
                false,
                '0x7e9f99b7971cb3de779690a82fec5e2ceec74dd0',
                { from: accounts[i] },
            );
            identities[i] = res.logs[0].args.newIdentity;
        }

        DC_wallet = accounts[accounts.length - 1];
        DC_identity = identities[identities.length - 1];
        DC_index = accounts.length - 1;

        creditorWallet = accounts[accounts.length - 2];
        creditorIndex = accounts.length - 2;

        // Generate creditor
        creditorContract = await Creditor.new(hub.address, { from: creditorWallet });
    });

    // eslint-disable-next-line no-undef
    beforeEach('Get initial values', async () => {
        initialState.creditorWalletTracBalance =
            await trac.balanceOf.call(creditorWallet);
        initialState.creditorContractTracBalance =
            await trac.balanceOf.call(creditorContract.address);
        initialState.DCcreditorContracCreditAllowance =
            await creditorContract.allowance.call(DC_identity);
        initialState.holdingContractCreditorContractTracAllowance = await trac.allowance.call(
            creditorContract.address,
            holding.address,
        );
        initialState.profileStorageTracBalance = await trac.balanceOf.call(profileStorage.address);

        const helperString = [];
        const promises = [];
        for (let i = 0; i < accounts.length; i += 1) {
            helperString[i] = `account${i}TracBalance`;
            helperString[accounts.length + i] = `profile${i}Stake`;
            helperString[(2 * accounts.length) + i] = `profile${i}StakeReserved`;

            promises[i] = trac.balanceOf.call(accounts[i]);
            promises[accounts.length + i] = profileStorage.getStake.call(identities[i]);
            promises[(2 * accounts.length) + i] =
                profileStorage.getStakeReserved.call(identities[i]);
        }
        const res = await Promise.all(promises);
        for (let i = 0; i < 3 * accounts.length; i += 1) {
            initialState[helperString[i]] = res[i];
        }

        Object.keys(initialState).forEach((key) => {
            delta[key] = new BN(0);
        });
    });

    // eslint-disable-next-line no-undef
    afterEach('Get final values', async () => {
        finalState.creditorWalletTracBalance =
            await trac.balanceOf.call(creditorWallet);
        finalState.creditorContractTracBalance =
            await trac.balanceOf.call(creditorContract.address);
        finalState.DCcreditorContracCreditAllowance =
            await creditorContract.allowance.call(DC_identity);
        finalState.holdingContractCreditorContractTracAllowance = await trac.allowance.call(
            creditorContract.address,
            holding.address,
        );
        finalState.profileStorageTracBalance = await trac.balanceOf.call(profileStorage.address);

        const helperString = [];
        const promises = [];
        for (let i = 0; i < accounts.length; i += 1) {
            helperString[i] = `account${i}TracBalance`;
            helperString[accounts.length + i] = `profile${i}Stake`;
            helperString[(2 * accounts.length) + i] = `profile${i}StakeReserved`;

            promises[i] = trac.balanceOf.call(accounts[i]);
            promises[accounts.length + i] = profileStorage.getStake.call(identities[i]);
            promises[(2 * accounts.length) + i] =
                profileStorage.getStakeReserved.call(identities[i]);
        }
        const res = await Promise.all(promises);
        for (let i = 0; i < 3 * accounts.length; i += 1) {
            finalState[helperString[i]] = res[i];
        }

        Object.keys(delta).forEach((key) => {
            if (!delta[key].isZero()) {
                console.log(`${key}:\n initialState: ${initialState[key].toString()} \n finalState: ${finalState[key].toString()} \n delta: ${delta[key].toString()}`);
                assert(finalState[key].eq(initialState[key].add(delta[key])), `${key} not changed correctly, got ${finalState[key]} but expected ${initialState[key].add(delta[key])}`);
            }
        });
    });

    // eslint-disable-next-line no-undef
    it('Should increase DC credit', async () => {
        assert(initialState.creditorContractTracBalance.isZero(), 'Initial balance of Creditor contract must be 0!');
        assert(initialState.DCcreditorContracCreditAllowance.isZero(), 'Initial allowance in Creditor contract must be 0!');
        assert(initialState.holdingContractCreditorContractTracAllowance.isZero(), 'Initial approval of Holding contract must be 0!');

        await trac.transfer(
            creditorContract.address,
            tokenAmountPerHolder.mul(new BN(3)),
            { from: creditorWallet },
        );
        delta.creditorWalletTracBalance = tokenAmountPerHolder.mul(new BN(3)).neg();
        delta.creditorContractTracBalance = tokenAmountPerHolder.mul(new BN(3));
        delta[`account${creditorIndex}TracBalance`] = tokenAmountPerHolder.mul(new BN(3)).neg();

        await creditorContract.increaseApproval(
            DC_identity,
            tokenAmountPerHolder.mul(new BN(3)),
            { from: creditorWallet },
        );
        delta.DCcreditorContracCreditAllowance =
            tokenAmountPerHolder.mul(new BN(3));
        delta.holdingContractCreditorContractTracAllowance =
            tokenAmountPerHolder.mul(new BN(3));
    });

    // eslint-disable-next-line no-undef
    it('Should finalize an offer using credit', async () => {
        // Execute tested function and set expected deltas
        let res = await holding.createOffer(
            DC_identity,
            dataSetId,
            dataRootHash,
            redLitigationHash,
            greenLitigationHash,
            blueLitigationHash,
            dcNodeId,
            holdingTimeInMinutes,
            tokenAmountPerHolder,
            dataSetSizeInBytes,
            litigationIntervalInMinutes,
            { from: DC_wallet },
        ).catch((err) => {
            assert(false, 'Failed to create offer!');
        });

        // eslint-disable-next-line prefer-destructuring
        const offerId = res.logs[0].args.offerId;

        const task = await holdingStorage.getOfferTask.call(offerId);
        const solution = await util.keccakAddressAddressAddress.call(
            identities[0],
            identities[1],
            identities[2],
        );

        for (var i = 65; i >= 2; i -= 1) {
            if (task.charAt(task.length - 1) === solution.charAt(i)) break;
        }
        if (i === 2) {
            assert(false, 'Could not find solution for offer challenge!');
        }
        const shift = 65 - i;

        // Getting hashes
        var hashes = [];
        for (i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            hashes[i] = await util.keccakBytesAddress.call(offerId, identities[i]);
        }

        // Getting confirmations
        var confirmations = [];
        for (i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            confirmations[i] = await web3.eth.accounts.sign(hashes[i], privateKeys[i]);
        }

        res = await holding.finalizeOfferFromCredit(
            DC_identity,
            creditorContract.address,
            offerId,
            shift,
            confirmations[0].signature,
            confirmations[1].signature,
            confirmations[2].signature,
            [new BN(0), new BN(1), new BN(2)],
            [identities[0], identities[1], identities[2]],
            { from: DC_wallet },
        );

        delta.creditorContractTracBalance = tokenAmountPerHolder.mul(new BN(3)).neg();
        delta.profileStorageTracBalance = tokenAmountPerHolder.mul(new BN(3));
        delta.holdingContractCreditorContractTracAllowance =
            tokenAmountPerHolder.mul(new BN(3)).neg();

        delta[`profile${DC_index}Stake`] = tokenAmountPerHolder.mul(new BN(3));
        delta.DCcreditorContracCreditAllowance = tokenAmountPerHolder.mul(new BN(3)).neg();

        delta[`profile${DC_index}StakeReserved`] = tokenAmountPerHolder.mul(new BN(3));
        for (i = 0; i < 3; i += 1) {
            delta[`profile${i}StakeReserved`] = tokenAmountPerHolder;
        }

        for (i = 0; i < 3; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            res = await holdingStorage.holder.call(offerId, identities[i]);

            assert(tokenAmountPerHolder.eq(res.stakedAmount), 'Token amount not matching!');
            assert.equal(res.litigationEncryptionType, i, 'Red litigation hash not matching!');
        }
    });
});
