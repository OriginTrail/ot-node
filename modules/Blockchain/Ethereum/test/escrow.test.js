const { assert, expect } = require('chai');

var TestUtils = artifacts.require('./TestingUtilities.sol'); // eslint-disable-line no-undef
var TracToken = artifacts.require('./TracToken.sol'); // eslint-disable-line no-undef
var EscrowHolder = artifacts.require('./EscrowHolder.sol'); // eslint-disable-line no-undef

var Web3 = require('web3');

// Constant values
const escrowDuration = 20;
const one_ether = '1000000000000000000';
var DC_wallet;
var DH_wallet;
const data_id = 20;
var escrow_address;

// eslint-disable-next-line no-undef
contract('Escrow testing', async (accounts) => {
    // eslint-disable-next-line no-undef
    it('Should get TracToken contract', async () => {
        await TracToken.deployed();
    });

    // eslint-disable-next-line no-undef
    it('Should get Escrow contract', async () => {
        await EscrowHolder.deployed();
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

    DC_wallet = accounts[0]; // eslint-disable-line prefer-destructuring
    DH_wallet = accounts[2]; // eslint-disable-line prefer-destructuring

    // eslint-disable-next-line no-undef
    it('Should mint 2 G tokens ', async () => {
        const trace = await TracToken.deployed();
        const amount = '2000000000';
        await trace.mint(DC_wallet, '1000000000', { from: accounts[0] });
        await trace.mint(DH_wallet, '1000000000', { from: accounts[0] });

        await trace.endMinting({ from: accounts[0] });

        let response = await trace.balanceOf.call(DC_wallet);
        const balance_DC = response.toNumber();
        console.log(`\t balance_DC: ${balance_DC}`);
        response = await trace.balanceOf.call(DH_wallet);
        const balance_DH = response.toNumber();
        console.log(`\t balance_DH: ${balance_DH}`);

        assert.equal(balance_DC, 1000000000, 'DC balance not 1 billion');
        assert.equal(balance_DH, 1000000000, 'DH balance not 1 billion');
    });

    // eslint-disable-next-line no-undef
    it('Should increase allowance for DC to 1000000000', async () => {
        const instance = await EscrowHolder.deployed();
        const trace = await TracToken.deployed();

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
    it('Should create an Escrow, lasting 20 blocks, valued 100000000 trace', async () => {
        const instance = await EscrowHolder.deployed();
        const util = await TestUtils.deployed();

        let response = await util.getBlockNumber.call();

        await instance.initiateEscrow(
            DC_wallet, DH_wallet, data_id, 100000000, 100000000, escrowDuration, { from: DC_wallet })
        .then((result) => {
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
                DC_wallet, data_id, 3 * 100000000,100000000, escrowDuration,
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

    it('Should increase DH-escrow approval before verification', async() => {
        const escrowInstance = await EscrowHolder.deployed();
        const tokenInstance = await TracToken.deployed();

        await tokenInstance.increaseApproval( escrow_address, 100000000, { from: DH_wallet });

        let response = await tokenInstance.allowance.call(DH_wallet, escrowInstance.address);
        let allowance_DH = response.toNumber();
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
