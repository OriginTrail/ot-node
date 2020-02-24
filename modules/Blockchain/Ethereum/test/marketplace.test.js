var BN = require('bn.js'); // eslint-disable-line no-undef
const { assert, expect } = require('chai');

var TestingUtilities = artifacts.require('TestingUtilities'); // eslint-disable-line no-undef
var TracToken = artifacts.require('TracToken'); // eslint-disable-line no-undef

var Hub = artifacts.require('Hub'); // eslint-disable-line no-undef

var Profile = artifacts.require('Profile'); // eslint-disable-line no-undef
var Marketplace = artifacts.require('Marketplace'); // eslint-disable-line no-undef

var ProfileStorage = artifacts.require('ProfileStorage'); // eslint-disable-line no-undef
var MarketplaceStorage = artifacts.require('MarketplaceStorage'); // eslint-disable-line no-undef

var Identity = artifacts.require('Identity'); // eslint-disable-line no-undef

var Web3 = require('web3');

var web3;

var Ganache = require('ganache-core');

// Helper variables
var seller_identity;
var buyer_identity;
var DC_wallet;
var offerId;
var tokensToDeposit = (new BN(100)).mul(new BN(10).pow(new BN(21)));
const emptyAddress = '0x0000000000000000000000000000000000000000';


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
var marketplace;
var marketplaceStorage;
var profileStorage;
var util;

// eslint-disable-next-line no-undef
contract('Offer testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    before(async () => {
        // Get contracts used in hook
        hub = await Hub.deployed();
        trac = await TracToken.deployed();
        profile = await Profile.deployed();
        marketplace = await Marketplace.deployed();
        marketplaceStorage = await MarketplaceStorage.deployed();
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

        // Increase approval for depositing tokens
        var promises = [];
        for (var i = 0; i < accounts.length; i += 1) {
            promises[i] = trac.increaseApproval(
                profile.address,
                tokensToDeposit,
                { from: accounts[i] },
            );
        }
        await Promise.all(promises);


        let res;
        // Generate profiles
        for (i = 0; i < accounts.length; i += 1) {
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
        seller_identity = identities[identities.length - 1];
    });

    // eslint-disable-next-line no-undef
    it('Should test one purchase', async () => {
        // Set variables
        const seller_identity = identities[0];
        const seller_wallet = accounts[0];
        const buyer_identity = identities[1];
        const buyer_wallet = accounts[1];

        const sellerStartStake =
            await profileStorage.getStake.call(seller_identity);
        const sellerStartStakeReserved =
            await profileStorage.getStakeReserved.call(seller_identity);
        const buyerStartStake =
            await profileStorage.getStake.call(buyer_identity);
        const buyerStartStakeReserved =
            await profileStorage.getStakeReserved.call(buyer_identity);

        const originalRootHash = dataSetId;
        const encodedRootHash = dataRootHash;
        const key = redLitigationHash;

        const price = new BN(10000, 10);

        let result = await marketplace.initiatePurchase(
            seller_identity,
            buyer_identity,
            price,
            originalRootHash,
            encodedRootHash,
            { from: buyer_wallet },
        );

        const { purchaseId } = result.logs[0].args;

        console.log('**************** Purchase after initation **************');
        result = await marketplaceStorage.purchase.call(purchaseId);
        console.log(JSON.stringify(result, null, 4));
        console.log('********************************************************');

        result = await profileStorage.getStakeReserved.call(buyer_identity);
        assert(buyerStartStakeReserved.add(price).eq(result), 'Reserved stake amount incorrect for buyer account upon initialization! '
            + `Expected ${buyerStartStakeReserved.add(price).toString()}, but got ${result.toString()}!`);

        result = await marketplace.revealKey(
            purchaseId,
            key,
            { from: seller_wallet },
        );

        console.log('**************** Purchase after key reveal **************');
        result = await marketplaceStorage.purchase.call(purchaseId);
        console.log(JSON.stringify(result, null, 4));
        console.log('********************************************************');

        result = await profileStorage.getStakeReserved.call(seller_identity);
        assert(sellerStartStakeReserved.add(price).eq(result), 'Reserved stake amount incorrect for seller account upon key reveal! '
            + `Expected ${sellerStartStakeReserved.add(price).toString()}, but got ${result.toString()}!`);

        // Move the payment timestamp halfway through the offer
        let timestamp = await marketplaceStorage.getTimestamp(purchaseId);
        timestamp = timestamp.subn(3000);
        await marketplaceStorage.setTimestamp(purchaseId, timestamp);

        await marketplace.takePayment(purchaseId, { from: seller_wallet });

        console.log('**************** Purchase after taking payment **************');
        result = await marketplaceStorage.purchase.call(purchaseId);
        console.log(JSON.stringify(result, null, 4));
        console.log('********************************************************');

        const sellerEndStake =
            await profileStorage.getStake.call(seller_identity);
        const sellerEndStakeReserved =
            await profileStorage.getStakeReserved.call(seller_identity);
        const buyerEndStake =
            await profileStorage.getStake.call(buyer_identity);
        const buyerEndStakeReserved =
            await profileStorage.getStakeReserved.call(buyer_identity);

        assert(sellerStartStakeReserved.eq(sellerEndStakeReserved), 'Reserved stake amount incorrect for seller account upon purchase completion! '
            + `Expected ${sellerStartStakeReserved.toString()}, but got ${sellerEndStakeReserved.toString()}!`);
        assert(buyerStartStakeReserved.eq(buyerEndStakeReserved), 'Reserved stake amount incorrect for buyer account upon purchase completion! '
            + `Expected ${buyerStartStakeReserved.toString()}, but got ${buyerEndStakeReserved.toString()}!`);


        assert(sellerStartStake.add(price).eq(sellerEndStake), 'Stake amount incorrect for seller account upon purchase completion! '
            + `Expected ${sellerStartStake.add(price).toString()}, but got ${sellerEndStake.toString()}!`);
        assert(buyerStartStake.sub(price).eq(buyerEndStake), 'Stake amount incorrect for buyer account upon purchase completion! '
            + `Expected ${buyerStartStake.sub(price).toString()}, but got ${buyerEndStake.toString()}!`);
    });
});
