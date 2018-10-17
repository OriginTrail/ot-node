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

var Identity = artifacts.require('Identity'); // eslint-disable-line no-undef

var Web3 = require('web3');

var web3;

var Ganache = require('ganache-core');

var _ = require('lodash');

// Global values
const tokensToDeposit = (new BN(10)).pow(new BN(20));
const nodeId = '0x4cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde';

// Profile variables
var identities = [];

// Hepler variables
var errored = true;

// eslint-disable-next-line no-undef
contract('Profile contract testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    before(async () => {
        // Generate web3 and set provider
        web3 = new Web3('HTTP://127.0.0.1:7545');
        web3.setProvider(Ganache.provider());
    });

    // eslint-disable-next-line no-undef
    it('Should create 10 profiles with existing identities', async () => {
        // Get contracts used in hook
        const trac = await TracToken.deployed();
        const profile = await Profile.deployed();
        const profileStorage = await ProfileStorage.deployed();

        var identities = [];
        for (var i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            identities[i] = await Identity.new(accounts[i], { from: accounts[i] });
        }

        var initialBalances = [];
        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            initialBalances[i] = await trac.balanceOf.call(accounts[i]);
        }

        var promises = [];
        for (i = 0; i < accounts.length; i += 1) {
            promises[i] = trac.increaseApproval(
                profile.address,
                tokensToDeposit,
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);

        promises = [];
        for (i = 0; i < accounts.length; i += 1) {
            promises[i] = profile.createProfile(
                nodeId,
                tokensToDeposit,
                true,
                identities[i].address,
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);

        // Get new balances
        var newBalances = [];
        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            newBalances[i] = await trac.balanceOf.call(accounts[i]);
            assert(
                newBalances[i].eq(initialBalances[i].sub(tokensToDeposit)),
                `Account balance for account ${i} does not match!`,
            );
        }

        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profileStorage.profile.call(identities[i].address);
            assert(
                tokensToDeposit.eq(res.stake),
                `Stake deposited not matching for account ${i}!`,
            );
            assert.equal(
                res.stakeReserved,
                0,
                `Stake reserved not 0 for account ${i}!`,
            );
            assert.equal(
                res.reputation,
                0,
                `Reputation not 0 for account ${i}!`,
            );
            assert.equal(
                res.withdrawalTimestamp,
                0,
                `Withdrawal timestamp not equal 0 for account ${i}!`,
            );
            assert.equal(
                res.withdrawalAmount,
                0,
                `Withdrawal amount not 0 for account ${i}!`,
            );
            assert.equal(
                res.nodeId,
                nodeId,
                `NodeId not equal to the submitted for account ${i}!`,
            );
        }
    });

    // eslint-disable-next-line no-undef
    it('Should create 10 profiles without existing identities', async () => {
        // Get contracts used in hook
        const trac = await TracToken.deployed();
        const profile = await Profile.deployed();
        const profileStorage = await ProfileStorage.deployed();

        var initialBalances = [];
        for (var i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            initialBalances[i] = await trac.balanceOf.call(accounts[i]);
        }

        var promises = [];
        for (i = 0; i < accounts.length; i += 1) {
            promises[i] = trac.increaseApproval(
                profile.address,
                tokensToDeposit,
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);

        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profile.createProfile(
                nodeId,
                tokensToDeposit,
                false,
                '0x7e9f99b7971cb3de779690a82fec5e2ceec74dd0',
                { from: accounts[i] },
            );
            identities[i] = res.logs[0].args.newIdentity;
        }

        // Get new balances
        var newBalances = [];
        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            newBalances[i] = await trac.balanceOf.call(accounts[i]);
            assert(
                newBalances[i].eq(initialBalances[i].sub(tokensToDeposit)),
                `Account balance for account ${i} does not match!`,
            );
        }

        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profileStorage.profile.call(identities[i]);
            assert(
                tokensToDeposit.eq(res.stake),
                `Stake deposited not matching for account ${i}!`,
            );
            assert.equal(
                res.stakeReserved,
                0,
                `Stake reserved not 0 for account ${i}!`,
            );
            assert.equal(
                res.reputation,
                0,
                `Reputation not 0 for account ${i}!`,
            );
            assert.equal(
                res.withdrawalTimestamp,
                0,
                `Withdrawal timestamp not equal 0 for account ${i}!`,
            );
            assert.equal(
                res.withdrawalAmount,
                0,
                `Withdrawal amount not 0 for account ${i}!`,
            );
            assert.equal(
                res.nodeId,
                nodeId,
                `NodeId not equal to the submitted for account ${i}!`,
            );
        }
    });

    // eslint-disable-next-line no-undef
    it('Should deposit tokens to profile', async () => {
        // Get contracts used in hook
        const trac = await TracToken.deployed();
        const profile = await Profile.deployed();
        const profileStorage = await ProfileStorage.deployed();

        var initialBalances = [];
        for (var i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            initialBalances[i] = await trac.balanceOf.call(accounts[i]);
        }

        var promises = [];
        for (i = 0; i < accounts.length; i += 1) {
            promises[i] = trac.increaseApproval(
                profile.address,
                tokensToDeposit,
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);

        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profile.depositTokens(
                identities[i],
                tokensToDeposit,
                { from: accounts[i] },
            );
        }

        // Get new balances
        var newBalances = [];
        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            newBalances[i] = await trac.balanceOf.call(accounts[i]);
            assert(
                newBalances[i].eq(initialBalances[i].sub(tokensToDeposit)),
                `Account balance for account ${i} does not match!`,
            );
        }

        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profileStorage.profile.call(identities[i]);
            assert(
                tokensToDeposit.mul(new BN(2)).eq(res.stake),
                `Stake deposited not matching for account ${i}!`,
            );
            assert.equal(
                res.stakeReserved,
                0,
                `Stake reserved not 0 for account ${i}!`,
            );
            assert.equal(
                res.reputation,
                0,
                `Reputation not 0 for account ${i}!`,
            );
            assert.equal(
                res.withdrawalTimestamp,
                0,
                `Withdrawal timestamp not equal 0 for account ${i}!`,
            );
            assert.equal(
                res.withdrawalAmount,
                0,
                `Withdrawal amount not 0 for account ${i}!`,
            );
            assert.equal(
                res.nodeId,
                nodeId,
                `NodeId not equal to the submitted for account ${i}!`,
            );
        }
    });

    // eslint-disable-next-line no-undef
    it('Should start token withdrawal process', async () => {
        // Get contracts used in hook
        const profile = await Profile.deployed();
        const profileStorage = await ProfileStorage.deployed();
        const util = await TestingUtilities.deployed();

        var timestamps = [];
        for (var i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profile.startTokenWithdrawal(
                identities[i],
                tokensToDeposit,
                { from: accounts[i] },
            );
            // eslint-disable-next-line no-await-in-loop
            timestamps[i] = await util.getBlockTimestamp.call();
        }

        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profileStorage.profile.call(identities[i]);
            assert(
                tokensToDeposit.mul(new BN(2)).eq(res.stake),
                `Stake deposited not matching for account ${i}!`,
            );
            assert(
                timestamps[i].add(new BN(300)).eq(res.withdrawalTimestamp),
                `Withdrawal timestamp incorrect for account ${i}!`,
            );
            assert(
                tokensToDeposit.eq(res.withdrawalAmount),
                `Withdrawal amount not set for account ${i}!`,
            );
            assert.equal(
                res.withdrawalPending,
                true,
                `Withdrawal flag not set for account ${i}!`,
            );
        }

        errored = false;

        // Wait half of the withdrawal delay
        await new Promise(resolve => setTimeout(resolve, 150000));
    });

    // eslint-disable-next-line no-undef
    it('Should complete token withdrawal process', async () => {
        // Get contracts used in hook
        const trac = await TracToken.deployed();
        const profile = await Profile.deployed();
        const profileStorage = await ProfileStorage.deployed();
        const util = await TestingUtilities.deployed();

        if (errored) assert(false, 'No use of running a test after previous test failed');
        // Wait other half of the withdrawal delay
        await new Promise(resolve => setTimeout(resolve, 150000));

        var initialBalances = [];
        for (var i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            initialBalances[i] = await trac.balanceOf.call(accounts[i]);
        }

        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profile.withdrawTokens(
                identities[i],
                { from: accounts[i] },
            );
        }

        // Get new balances
        var newBalances = [];
        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            newBalances[i] = await trac.balanceOf.call(accounts[i]);
            assert(
                newBalances[i].eq(initialBalances[i].add(tokensToDeposit)),
                `Account balance for account ${i} does not match!`,
            );
        }

        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            const res = await profileStorage.profile.call(identities[i]);
            // eslint-disable-next-line no-await-in-loop
            const timestamp = await util.getBlockTimestamp.call();
            assert(
                tokensToDeposit.eq(res.stake),
                `Stake deposited not matching for account ${i}!`,
            );
            assert.equal(
                res.withdrawalPending,
                false,
                `Withdrawal flag not reset for account ${i}!`,
            );
        }
    });
});
