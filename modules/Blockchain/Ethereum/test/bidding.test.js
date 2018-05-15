const { assert, expect } = require('chai');

var TestUtils = artifacts.require('./TestingUtilities.sol'); // eslint-disable-line no-undef
var TracToken = artifacts.require('./TracToken.sol'); // eslint-disable-line no-undef
var EscrowHolder = artifacts.require('./EscrowHolder.sol'); // eslint-disable-line no-undef
var Bidding = artifacts.require('./Bidding.sol'); // eslint-disable-line no-undef

var Web3 = require('web3');

// Constant values
const escrowDuration = 20;
const one_ether = '1000000000000000000';
var DC_wallet;
var DH_wallet;
const data_id = 20;
var escrow_address;
var bidding_address;

// eslint-disable-next-line no-undef
contract('Bidding testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    it('Should get TracToken contract', async () => {
        await TracToken.deployed();
    });

    // eslint-disable-next-line no-undef
    it('Should get Escrow contract', async () => {
        await EscrowHolder.deployed();
    });

    // eslint-disable-next-line no-undef
    it('Should get Bidding contract', async () => {
        await Bidding.deployed();
    });

    // eslint-disable-next-line no-undef
    it('Should wait for the escrow to be deployed', async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    // eslint-disable-next-line no-undef
    it('Should get the escrow_address', async () => {
        await EscrowHolder.deployed().then((res) => {
            escrow_address = res.address;
        }).catch(err => console.log(err));
        console.log(`\t Escrow address: ${escrow_address}`);
    });

    // eslint-disable-next-line no-undef
    it('Should get the bidding_address', async () => {
        await Bidding.deployed().then((res) => {
            bidding_address = res.address;
        }).catch(err => console.log(err));
        console.log(`\t Bidding address: ${bidding_address}`);
    });

    DC_wallet = accounts[0]; // eslint-disable-line prefer-destructuring
    DH_wallet = accounts[1]; // eslint-disable-line prefer-destructuring

    // eslint-disable-next-line no-undef
    it('Should mint 5e25 (accounts 0 and 1,2,3,4,5)', async () => {
        const trace = await TracToken.deployed();
        const amount = 5e25;
        for (var i = 10; i >= 0; i -= 1) {
            // eslint-disable-next-line no-await-in-loop
            await trace.mint(accounts[i], amount, { from: accounts[0] });
        }
        await trace.endMinting({ from: accounts[0] });

        const response = await trace.balanceOf.call(accounts[0]);
        const actual_balance = response.toNumber();
        console.log(`\t balance: ${actual_balance}`);

        assert.equal(actual_balance, amount, 'balance not 5e25');
    });

    // eslint-disable-next-line no-undef
    it('Should increase allowance for DC to 100 000 TRAC', async () => {
        const instance = await EscrowHolder.deployed();
        const trace = await TracToken.deployed();

        let response = await trace.allowance.call(DC_wallet, escrow_address);
        let allowance_DC = response.toNumber();
        console.log(`\t allowance_DC: ${allowance_DC}`);


        await trace.increaseApproval(escrow_address, 1e23, { from: DC_wallet });

        response = await trace.allowance.call(DC_wallet, instance.address);
        allowance_DC = response.toNumber();
        console.log(`\t allowance_DC: ${allowance_DC}`);

        assert.equal(allowance_DC, 100000000, 'The proper amount was not allowed');
    });

    // eslint-disable-next-line no-undef
    it('Should create an Escrow, lasting 20 blocks, valued 100000000 trace', async () => {
        const instance = await EscrowHolder.deployed();
        const util = await TestUtils.deployed();

        let response = await util.getBlockNumber.call();

        await instance.initiateEscrow(
            DC_wallet,
            DH_wallet,
            data_id,
            100000000,
            100000000,
            escrowDuration,
            { from: DC_wallet },
        ).then((result) => {
            console.log(`\t Initiate escrow - Gas used : ${result.receipt.gasUsed}`);
        });

        response = await instance.escrow.call(DC_wallet, DH_wallet, data_id);


        let token_amount = response[0];
        token_amount = token_amount.toNumber();

        let tokens_sent = response[1];
        tokens_sent = tokens_sent.toNumber();

        let stake_amount = response[2];
        stake_amount = stake_amount.toNumber();

        let actual_startTime = response[3];
        actual_startTime = actual_startTime.toNumber();

        let endTime = response[4];
        endTime = endTime.toNumber();

        let total_time = response[5];
        total_time = total_time.toNumber();

        let status = response[6];
        status = status.toNumber();
        switch (status) {
        case 0:
            status = 'initated';
            break;
        case 1:
            status = 'verified';
            break;
        case 2:
            status = 'canceled';
            break;
        case 3:
            status = 'completed';
            break;
        default:
            status = 'err';
            break;
        }

        console.log('Escrow values: ');
        console.log(`\t token_amount: ${token_amount}`);
        console.log(`\t tokens_sent: ${tokens_sent}`);
        console.log(`\t stake_amount: ${stake_amount}`);
        console.log(`\t start_time: ${actual_startTime}`);
        console.log(`\t end_time: ${endTime}`);
        console.log(`\t total_time: ${total_time}`);
        console.log(`\t status: ${status}`);


        assert.equal(token_amount, 100000000, 'Amount of tokens does not match!');
        assert.equal(tokens_sent, 0, 'Sent tokens not equal zero!');
        // eslint-disable-next-line no-undef
        assert.equal(stake_amount, 100000000, 'Stake amount does not match!');
        assert.equal(0, actual_startTime, 'Start time not equal zero!');
        assert.equal(0, endTime, 'End time not equal zero!');
        assert.equal(escrowDuration, total_time, 'Escrow duration does not match!');
        assert.equal(status, 'initated', 'Escrow status not initated properly!');
    });

    // eslint-disable-next-line no-undef
    it('Should break - DH verifies escrow with wrong token amount', async () => {
        const instance = await EscrowHolder.deployed();

        let error;
        try {
            await instance.verifyEscrow(
                DC_wallet,
                data_id,
                3 * 100000000,
                100000000,
                escrowDuration,
                { from: DH_wallet },
            ).then((result) => {
                console.log(`\t Verify escrow - Gas used : ${result.receipt.gasUsed}`);
            });
        } catch (e) {
            error = e;
        }

        assert.notEqual(error, undefined, 'Error must be thrown');
        assert.isAbove(error.message.search('Exception while processing transaction: revert'), -1, 'revert error must be returned');
    });

    // eslint-disable-next-line no-undef
    it('Should increase DH-escrow approval before verification', async () => {
        const escrowInstance = await EscrowHolder.deployed();
        const tokenInstance = await TracToken.deployed();

        await tokenInstance.increaseApproval(escrow_address, 100000000, { from: DH_wallet });

        const response = await tokenInstance.allowance.call(DH_wallet, escrowInstance.address);
        const allowance_DH = response.toNumber();
        console.log(`\t allowance_DH: ${allowance_DH}`);

        assert.equal(allowance_DH, 100000000, 'The proper amount was not allowed');
    });

    // eslint-disable-next-line no-undef
    it('Should verify an existing escrow', async () => {
        const instance = await EscrowHolder.deployed();

        await instance.verifyEscrow(
            DC_wallet, data_id, 100000000, 100000000, escrowDuration,
            { from: DH_wallet },
        ).then((result) => {
            console.log(`\t Verify escrow - Gas used : ${result.receipt.gasUsed}`);
        });

        const response = await instance.escrow.call(DC_wallet, DH_wallet, data_id);
        let status = response[6];
        status = status.toNumber();
        switch (status) {
        case 0:
            status = 'initated';
            break;
        case 1:
            status = 'verified';
            break;
        case 2:
            status = 'canceled';
            break;
        case 3:
            status = 'completed';
            break;
        default:
            status = 'err';
            break;
        }

        console.log(`\t Status: ${status}`);
        assert.equal(status, 'verified', "Escrow wasn't verified");
    });
});
