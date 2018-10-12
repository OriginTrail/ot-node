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
contract('Dev testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    before(async () => {
        // Get contracts used in hook
        const trac = await TracToken.deployed();
        const profile = await Profile.deployed();

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
        for (var i = 0; i < accounts.length; i += 1) {
            promises[i] = trac.increaseApproval(
                profile.address,
                (new BN(5)).mul(new BN(10).pow(new BN(20))),
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);


        var res;
        // Generate profiles
        for (i = 0; i < accounts.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            res = await profile.createProfile(
                '0x4cad6896887d99d70db8ce035d331ba2ade1a5e1161f38ff7fda76cf7c308cde',
                (new BN(5)).mul(new BN(10).pow(new BN(20))),
                false,
                { from: accounts[i] },
            );
            identities[i] = res.logs[0].args.newIdentity;
        }

        DC_wallet = accounts[accounts.length - 1];
        DC_identity = identities[identities.length - 1];
    });

    // eslint-disable-next-line no-undef
    it('Should test shift', async () => {
        // Get instances of contracts used in the test
        const util = await TestingUtilities.deployed();

        const w1 = '0x5c1badba5d26a6b06bda5964001366ad748abc4e';
        const w2 = '0x7e9f99b7971cb3de779690a82fec5e2ceec74dd0';
        const w3 = '0xb223a4b258e74ca5dd8e25d9e319359d8620630f';

        let shift = 46;
        const task = '2';
        var solution;

        let dummy = '';
        for (var i = 0; i < 66; i += 1) {
            if (i % 10 !== 0) dummy = (i % 10) + dummy;
            else dummy = (i / 10) + dummy;
        }

        console.log(`${solution = await util.keccakAddressAddressAddress.call(w1, w2, w3)}`);
        console.log(dummy);
        console.log(`${await util.getSolution.call(w1, w2, w3, shift)}`);

        for (var i = 65; i >= 2; i -= 1) {
            if (task === solution.charAt(i)) break;
        }
        console.log(`${shift = 65 - i}`);
        console.log('0x' + 'f1d5bfca3f7616ad02abcd10c993b0dae890e09a628ec188205a36b278725e62');
    });

    // eslint-disable-next-line no-undef
    it('Should test confirmations', async () => {
        // Get instances of contracts used in the test
        const util = await TestingUtilities.deployed();

        const offer = '0x5da191ba5ed8e39b6a5b87eeb3a521c442f92cf552975521b02f876ad7221f4a';
        const identity = '0x100c2bdcbb88ccc9f85603995c40fed2f22eac1e';
        const wallet = '0x7e9f99b7971cb3de779690a82fec5e2ceec74dd0';
        const confirmation = '0xab1103e574a37e54c50287c81f20276b7f257a9bf793e55da5ac52eac293fd1a6d636c8563bfced189dd97fa57ef4e2848515615a93c621e60cce9b8dcf719631c';
        const privateKey = '0xa17ba5f0b679eb9291eb76562a269a6df40313972ad9e539da74573afcead4a2';

        // Check hash first
        // console.log('Hashes:');
        // console.log(`Node offer: ${offer}`);
        const hash = await util.keccakBytesAddress.call(offer, identity);
        console.log(`SmCn offer: ${hash} \n`);

        // Check signature
        console.log('Confirmations:');
        console.log(`Node confirmation: ${confirmation}`);
        const myConfirmation = await web3.eth.accounts.sign(hash, privateKey);
        console.log(`SmCn confirmation: ${myConfirmation.signature} \n`);


        // Check ecrecovery
        console.log('Confirmations:');
        console.log(`Node original wallet: ${wallet}`);
        const ecrecWallet = await util.ecrecovery.call(hash, confirmation);
        console.log(`Node ecrecovr wallet: ${ecrecWallet}`);
        const scWallet = await util.ecrecovery.call(hash, myConfirmation.signature);
        console.log(`SmCn ecrecovr wallet: ${scWallet}\n`);

        // Check hash
        console.log('Hashes:');
        console.log(`${await util.keccakAddress.call(wallet)}`);
        console.log(`${await util.keccakAddress.call(ecrecWallet)}`);
        console.log(`${await util.keccakAddress.call(scWallet)}\n`);
    });
});
