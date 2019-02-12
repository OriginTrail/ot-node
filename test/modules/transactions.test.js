/* eslint-disable no-unused-expressions, max-len, no-console */
const {
    describe, before, after, it,
} = require('mocha');
const { expect } = require('chai');
const Ganache = require('ganache-core');
const Web3 = require('web3');
const EthWallet = require('ethereumjs-wallet');
const BN = require('bn.js');

const Transactions = require('../../modules/Blockchain/Ethereum/Transactions');

const accountPrivateKeys = [
    '3cf97be6177acdd12796b387f58f84f177d0fe20d8558004e8db9a41cf90392a',
    '1e60c8e9aa35064cd2eaa4c005bda2b76ef1a858feebb6c8e131c472d16f9740',
    '2c26a937a1b8b20762e2e578899b98fd48b6ab2f8798cd03ccef2bee865c2c54',
];

const wallets = accountPrivateKeys.map(privateKey => ({
    address: `0x${EthWallet.fromPrivateKey(Buffer.from(privateKey, 'hex')).getAddress().toString('hex')}`,
    privateKey,
}));

describe('Transactions class object tests', () => {
    let server;
    let web3;
    before('Setup blockchain', (done) => {
        server = Ganache.server({
            gasLimit: 7000000,
            accounts:
                accountPrivateKeys.map(account => ({
                    secretKey: `0x${account}`,
                    balance: Web3.utils.toWei('100', 'ether'),
                })),
        });

        server.listen(7545, async (err, blockchain) => {
            if (err) {
                done(err);
                return;
            }
            web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
            done();
        });
    });

    after('Cleanup', () => {
        if (server) {
            server.close();
        }
    });

    it('Should initialize normally', () => {
        const transactions = new Transactions(web3, wallets[0].address, wallets[0].privateKey);
        expect(transactions).to.not.be.undefined;
    });

    it('Should fail with warning for transactions if wallet has less than 300k * gasPrice', async () => {
        const testWallet = wallets[0].address;
        const testWalletKey = wallets[0].privateKey;
        const gasPrice = await web3.eth.getGasPrice();
        const gasLimit = '200000';

        let balance = await web3.eth.getBalance(testWallet);
        balance = new BN(balance);

        // Send Ethers so only ((300k * gas-price) - 1) is left.
        const toSend = balance
            .sub(new BN(gasPrice, 10).imuln(21000)) // Transaction price
            .sub(new BN(300000).imul(new BN(gasPrice)))
            .iaddn(1);
        await web3.eth.sendTransaction({
            to: wallets[1].address,
            from: testWallet,
            value: toSend,
            gas: 21000,
            gasPrice,
        });
        balance = await web3.eth.getBalance(testWallet);
        expect(balance).to.equal('5999999999999999');

        const options = {
            gasLimit: web3.utils.toHex(gasLimit),
            gasPrice: web3.utils.toHex(gasPrice),
            to: this.tokenContractAddress,
            value: '1',
        };

        const logger = console;
        const warnings = [];
        logger.warn = (message => warnings.push(message));
        const transactions = new Transactions(web3, testWallet, testWalletKey, logger);

        const dummyAbi = [
            {
                constant: false,
                inputs: [],
                name: 'dummyMethod',
                outputs: [],
                payable: false,
                stateMutability: 'nonpayable',
                type: 'function',
            },
        ];
        try {
            // Transaction should fail because of the false ABI.
            await transactions.queueTransaction(dummyAbi, 'dummyMethod', [], options);
        } catch (error) {
            expect(warnings).to.have.lengthOf(1);
            expect(warnings[0]).to.equal('ETH balance running low! Your balance: 5999999999999999  wei, while minimum required is: 6000000000000000 wei');
            return;
        }
        throw Error('Transaction should fail.');
    });

    it('Should fail with warning for transactions if wallet has less than 300k * gasPrice', async () => {
        const testWallet = wallets[2].address;
        const testWalletKey = wallets[2].privateKey;
        const gasPrice = await web3.eth.getGasPrice();
        const gasLimit = '2000000';

        let balance = await web3.eth.getBalance(testWallet);
        balance = new BN(balance);

        // Send Ethers so less than gas-price * gas-limit is left.
        const toSend = balance
            .sub(new BN(gasPrice, 10).imuln(21000)) // Transaction price
            .sub(new BN(300000).imul(new BN(gasPrice)))
            .iaddn(1);
        await web3.eth.sendTransaction({
            to: wallets[1].address,
            from: testWallet,
            value: toSend,
            gas: 21000,
            gasPrice,
        });
        balance = await web3.eth.getBalance(testWallet);
        expect(balance).to.equal('5999999999999999');

        const options = {
            gasLimit: web3.utils.toHex(gasLimit),
            gasPrice: web3.utils.toHex(gasPrice),
            to: this.tokenContractAddress,
            value: '1',
        };

        const logger = console;
        const warnings = [];
        logger.warn = (message => warnings.push(message));
        const transactions = new Transactions(web3, testWallet, testWalletKey, logger);

        const dummyAbi = [
            {
                constant: false,
                inputs: [],
                name: 'dummyMethod',
                outputs: [],
                payable: false,
                stateMutability: 'nonpayable',
                type: 'function',
            },
        ];
        try {
            // Transaction should fail because of the false ABI.
            await transactions.queueTransaction(dummyAbi, 'dummyMethod', [], options);
        } catch (error) {
            expect(error.toString())
                .to.equal('Error: Error: ETH balance lower (5999999999999999) than transaction cost (40000000000000000).');
            return;
        }
        throw Error('Transaction should fail.');
    });
});
