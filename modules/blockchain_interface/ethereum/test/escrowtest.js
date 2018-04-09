const { assert, expect } = require('chai');

var TestUtils = artifacts.require('./TestingUtilities.sol'); // eslint-disable-line no-undef
var TestTracToken = artifacts.require('./TestTracToken.sol'); // eslint-disable-line no-undef
var EscrowHolder = artifacts.require('./EscrowHolder.sol'); // eslint-disable-line no-undef

var Web3 = require('web3');
// Constant values
const REVERT_MSG = 'VM Exception while processing transaction: revert';
const escrowDuration = 20;
const one_ether = '1000000000000000000';
var DC_wallet;
var DH_wallet;
const data_id = 20;
var escrow_address;

let util;

// eslint-disable-next-line no-undef
contract('Escrow testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    before('make sure contacts TestTracToken and Escrow are deployed', async () => {
        await TestTracToken.deployed();
        await EscrowHolder.deployed();
        util = await TestUtils.deployed();
    });

    // eslint-disable-next-line no-undef
    it('Should get the escrow_address', async () => {
        await EscrowHolder.deployed().then((res) => {
            escrow_address = res.address;
        }).catch(err => console.log(err));
        console.log(`\t Escrow address: ${escrow_address}`);
    });

    // accounts 0,1,2 already assigned while deploying
    DC_wallet = accounts[3]; // eslint-disable-line prefer-destructuring
    DH_wallet = accounts[4]; // eslint-disable-line prefer-destructuring

    async function getDCBalance(trace) {
        const response = await trace.balanceOf.call(DC_wallet);
        const balance_DC = response.toNumber();
        console.log(`\t balance_DC: ${balance_DC}`);
        return balance_DC;
    }

    async function getDHBalance(trace) {
        const response = await trace.balanceOf.call(DH_wallet);
        const balance_DH = response.toNumber();
        console.log(`\t balance_DH: ${balance_DH}`);
        return balance_DH;
    }

    // eslint-disable-next-line no-undef
    it('Should mint 2 G tokens ', async () => {
        const trace = await TestTracToken.deployed();

        const initialDCBalance = await getDCBalance(trace);
        const initialDHBalance = await getDCBalance(trace);
        assert.equal(initialDCBalance, 0);
        assert.equal(initialDHBalance, 0);

        // const amount = '2000000000';
        await trace.mint(DC_wallet, '1000000000', { from: accounts[0] });
        await trace.mint(DH_wallet, '1000000000', { from: accounts[0] });

        await trace.endMinting({ from: accounts[0] });

        const balance_DC = await getDCBalance(trace);
        const balance_DH = await await getDCBalance(trace);

        assert.equal(balance_DC, 1000000000, 'DC balance is not 1 billion');
        assert.equal(balance_DH, 1000000000, 'DH balance is not 1 billion');
    });

    // eslint-disable-next-line no-undef
    it('Should increase allowance for DC to 1000000000', async () => {
        const instance = await EscrowHolder.deployed();
        const trace = await TestTracToken.deployed();

        let response = await trace.allowance.call(DC_wallet, instance.address);
        let allowance_DC = response.toNumber();
        console.log(`\t allowance_DC: ${allowance_DC}`);

        await trace.increaseApproval(instance.address, 100000000, { from: DC_wallet });

        response = await trace.allowance.call(DC_wallet, instance.address);
        allowance_DC = response.toNumber();
        console.log(`\t allowance_DC: ${allowance_DC}`);
        assert.equal(allowance_DC, 100000000, 'The proper amount was not allowed');
    });

    // eslint-disable-next-line no-undef
    it('.initiateEscrow() should create an Escrow, lasting escrowDuration blocks, valued 100000000 trace', async () => {
        const instance = await EscrowHolder.deployed();

        await instance.initiateEscrow(
            DH_wallet, data_id, 100000000, escrowDuration,
            { from: DC_wallet },
        ).then((result) => {
            console.log(`\t Initiate escrow - Gas used : ${result.receipt.gasUsed}`);
            assert.equal(result.logs[0].event, 'EscrowInitated', 'EscrowInitated event should be emited');
        });

        const response = await instance.escrow.call(DC_wallet, DH_wallet, data_id);

        let token_amount = response[0];
        token_amount = token_amount.toNumber();

        let tokens_sent = response[1];
        tokens_sent = tokens_sent.toNumber();

        let actual_startTime = response[2];
        actual_startTime = actual_startTime.toNumber();

        let endTime = response[3];
        endTime = endTime.toNumber();

        let total_time = response[4];
        total_time = total_time.toNumber();

        let status = response[5];
        status = status.toNumber();
        switch (status) {
        case 0:
            status = 'initiated';
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
        console.log(`\t start_time: ${actual_startTime}`);
        console.log(`\t end_time: ${endTime}`);
        console.log(`\t total_time: ${total_time}`);
        console.log(`\t status: ${status}`);

        assert.equal(token_amount, 100000000, 'Amount of tokens does not match!');
        assert.equal(tokens_sent, 0, 'Sent tokens not equal zero!');
        assert.equal(0, actual_startTime, 'Start time not equal zero!');
        assert.equal(0, endTime, 'End time not equal zero!');
        assert.equal(escrowDuration, total_time, 'Escrow duration does not match!');
        assert.equal(status, 'initiated', 'Escrow status not initated properly!');
    });

    // eslint-disable-next-line no-undef
    it('.verifyEscrow() - DH should not verify escrow with wrong token amount', async () => {
        const instance = await EscrowHolder.deployed();

        let error;
        try {
            await instance.verifyEscrow(
                DC_wallet, data_id, 3 * 100000000, escrowDuration,
                { from: DH_wallet },
            ).then((result) => {
                console.log(`\t Verify escrow - Gas used : ${result.receipt.gasUsed}`);
            });
        } catch (e) {
            error = e;
        }

        assert.notEqual(error, undefined, 'Error must be thrown');
        assert.equal(error.message, REVERT_MSG);
    });

    // eslint-disable-next-line no-undef
    it('.verifyEscrow() should verify an existing escrow', async () => {
        const instance = await EscrowHolder.deployed();

        await instance.verifyEscrow(
            DC_wallet, data_id, 100000000, escrowDuration,
            { from: DH_wallet },
        ).then((result) => {
            console.log(`\t Verify escrow - Gas used : ${result.receipt.gasUsed}`);
            assert.equal(result.logs[0].event, 'EscrowVerified', 'EscrowVerified event should be emited');
        });

        const response = await instance.escrow.call(DC_wallet, DH_wallet, data_id);
        let status = response[5];
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

    // eslint-disable-next-line no-undef
    it('.payOut() - should pay DC deserved renumeration', async () => {
        const instance = await EscrowHolder.deployed();
        const trace = await TestTracToken.deployed();

        const balance_DC_before = await getDCBalance(trace);
        const balance_DH_before = await getDHBalance(trace);

        // TODO something to simulate block increment

        await instance.payOut(
            DC_wallet, data_id,
            { from: DH_wallet },
        ).then((result) => {
            console.log(`\t Cancel escrow - Gas used : ${result.receipt.gasUsed}`);
            // TODO investigate why there was no event emited ?
            // assert.equal(result.logs[0].event,
            // "EscrowCompleted", "EscrowCompleted event should be emited");
        });

        const balance_DC_after = await getDCBalance(trace);
        const balance_DH_after = await getDHBalance(trace);

        assert.isTrue(balance_DH_after > balance_DH_before, 'DC should get some renumenration');
    });

    // eslint-disable-next-line no-undef
    it('.cancelEscrow() - should cancel escrow contract', async () => {
        const trace = await TestTracToken.deployed();
        const instance = await EscrowHolder.deployed();

        await getDCBalance(trace);
        await getDHBalance(trace);

        await instance.cancelEscrow(DH_wallet, data_id, { from: DC_wallet }).then((result) => {
            console.log(`\t Cancel escrow - Gas used : ${result.receipt.gasUsed}`);
            assert.equal(result.logs[0].event, 'EscrowCanceled', 'EscrowCanceled event should be emited');
        });

        await getDCBalance(trace);
        await getDHBalance(trace);
    });
});
