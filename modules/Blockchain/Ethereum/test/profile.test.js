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
var DC_wallet;
var DC_identity;

// Offer variables
var import_id = 0;
const data_size = 1;
const total_escrow_time = 1;
const max_token_amount = 1000e18;
const min_stake_amount = 10e12;
const min_reputation = 0;
const predestined_first_bid_index = 9;

// Profile variables
var privateKeys = [];
var identities = [];

// eslint-disable-next-line no-undef
contract('Profile contract testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    before(async () => {
        // Get contracts used in hook
        const trac = await TracToken.deployed();
        const profile = await Profile.deployed();

        // Generate web3 and set provider
        web3 = new Web3('HTTP://127.0.0.1:7545');
        web3.setProvider(Ganache.provider());
    });

    const tokensToDeposit = (new BN(10)).pow(new BN(20));

    // eslint-disable-next-line no-undef
    it('Should create 10 profiles with existing identities', async () => {
        // Get contracts used in hook
        const trac = await TracToken.deployed();
        const profile = await Profile.deployed();

        var identities = [];
        for (var i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            identities[i] = await Identity.new(accounts[i], { from: accounts[i] });
        }

        var initialBalances = [];
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
                '0x4cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde',
                tokensToDeposit,
                true,
                identities[i].address,
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);
    });
});
