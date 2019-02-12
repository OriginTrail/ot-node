/* eslint-disable no-unused-expressions, max-len, no-console */
const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
const { expect } = require('chai');
const Ganache = require('ganache-core');
const Web3 = require('web3');
const EthWallet = require('ethereumjs-wallet');
const BN = require('bn.js');

const Utilities = require('../../modules/Utilities');
const Transactions = require('../../modules/Blockchain/Ethereum/Transactions');

const accountPrivateKeys = [
    '3cf97be6177acdd12796b387f58f84f177d0fe20d8558004e8db9a41cf90392a',
    '1e60c8e9aa35064cd2eaa4c005bda2b76ef1a858feebb6c8e131c472d16f9740',
    '2c26a937a1b8b20762e2e578899b98fd48b6ab2f8798cd03ccef2bee865c2c54',
    'a76e13d35326f5e06d20655d0edb2f60b8863280fabf8e3f0b1210cf0bb72eec',
    'd96876d0711ed11781efe0c04c95716c2e0acabc4eba418516d76be808a2fc54',
    '6be9ea24e3c2adf0ac4c6705b445827a57c80e6fefa10df3f480da8aa2c523a4',
    '6627e24e68bca3b29c548789aead92b48c0f4ce669842ff7e18ca356429b804c',
    '1e3bae753e15ee5e6e2548105b53736a3db7304ac7681d00c77caca0b848b0ba',
    '4bc5744a30e928d162ca580f9a034dfac7edc0415e0b9ddc2d221a155f6ec4ff',
    '03c5646544ea8e47174ac98e3b97338c486860897e31333318ee62d19e5ea118',
    '9fe33d5460d64c2993c687b9f2b6c3503e082388f59d0fea14142d20f805fcc5',
    '843c42e809fc394e1d8647cd74edee133d5faa187933dc0fc08d302f57b6333c',
    '81feca24308a669408b973dc010800d93d347db851ff9fc12ba7ec4e60846ee3',
    '2fbcf9435210fed8dd47dccae453df02c0159c265dc454be8a24e4189e2a3c1b',
    '5a03ebd83bf32553f00f33255154158a07020ebc2921d842a5aee2ab94370969',
    '13a8fc7dac578c05cbae943f220477b2abcb9954c8cb31279fce2f864558420c',
    'd35889eb100eb5544ea3e9ddab1181e628dc8e167365dcf97112fab9ae0db906',
    'f261d13fb3fd1f3df2f5dc75b54066d354a25aa2800b90b42900fc0db794cc41',
    'a6dc4993c4a65f78ad87cf972f468fe25c1ad86f32d479f2ad27d3c8f46a6487',
    '5fc5a969744f359c109b64bb41dca7e49e1086a9298c862cd0e30772908bb70c',
    'c00655521fa1326b8b1831fb74b2a5e45eca0e8e886df34e9a714ae70031c502',
    'feee5c36d8a9b1c65d9b0810f048d817d6cd01f95b12e3ae8940a769e2a6d217',
    'edf15b05b906d2582d269d81fe85ee64325fa081aafd64de32893d4d6b03f56d',
    '92f6678cdb6ce485e305d5fa926d2d157745871fc7d72f0526048f8286f28247',
    'dfa44843c22ae16de69e9181e2bfe2153e36464d266e32746de82478e9674d98',
    '483af28e4e11638d018a4fa02dcb454cfff8235073921aefdb5a302956c6abb0',
    '8908b19e6f8ed4aabe160719cc3cb2b15aabf79cfc436ad31574eedd2432e3bc',
    '6b499a1289d1945cbc232bd47da77ae10432ffb63b7f6d04b797a74f30f22c7d',
    'db908900b007ba9c384b116b6d1209d4842f37e2435d7fbd62d619643bb08e08',
    'f5346004b07b6059be546f02b72a29f055251471c700e799f96529b4338ad635',
    '2aa43025590ae9e9fb3eaaa75358e3a6e1719570864c43a33926a19da979ced9',
    '1aa051ed6f3c40a01cad84d2c05ae3a80d897a3f7b56a88447643fc9e67cc004',
    'c4505f045420e9c860989349d32a7716a9c6221c8bfc17e1012b06c4b926e530',
    '35fbcc677cd348dafaa2c31519f458dcc9ddbb7278e38310e974787ca378a4a8',
    '90505a5408c91fc59738f12c31f14a501c431160473819c4e7e9273092ebb288',
    'e2eed5df7e6f32dfb793b7324e251950a8644d409aa194de822c1e42163e947e',
    '1ac1f2db31610c84f09865b308b82d6236e09acd475b4136bd86440b7aa39c41',
    '77ffe9a3e5738d8fc2fa14028e5e280872f87c7dfb5df58bd21cc6f2c7ce6f72',
    'eb48615474a318cbd2e6197d01bf81d168f2d21a2a8a117bc979a887ec90d2df',
    'f1a9455826b46ca2f9f66457d8faa6f02a30e1c0f0b5b5f6769b769974a5cc5f',
    'afa420d816b8b97b5049ce4507b1c79ee26168bc4a197385cd848dd482746e2d',
    '9fd7088936411d814238aa7072dc43c28e6ae7d298db37466dc6b3236191c3de',
    '03199565ef8a1421b7fa73cbb4b4e6f4cb3470affcf8b18f783e192788d23519',
    '27fa0a7dd2901067308dd9f2559204006712dc2809619a922a5fc3f43199a9b9',
    '7ff5132877ee3ebaeed1664e3ff5abdcc7fb7cce57b74ce8ae2f0071e7132ab9',
    '5bd9b42788ec465d52598e58857bae2b592c5b5cf8678693179a687317fe7928',
    '7471241aa4a8d04058279da9266f44210a4ffd4d6ff16376ad3cab733cce3e8f',
    '5ad0f83dadefdeefeee58d733ba35674f151dc1a1080bfafb9fb8778285f0646',
    '966658dfe2cf0dfa999ef05ca3c926c5fe776ee4cbc7673bdea69d2907030357',
    '440f37a3f0fe7560db8bc00200818c743a4a381b4d6b24967c31fc47d5ab831b',
    '4072914e2feb382b79d5285d293902546938aa2b0e31cd6625ce59db77a6d3d4',
    '7b39d2f9dcf59d87ca683d9797ac3f8c5ba7c9bc6ec4b6b5cfd27809160b64cb',
    '455d135639bfaab54ffc729a873a1cea26e438600f0ef40642abbd2a91c9eae3',
    'f04349eab3a51e2e871cbfd30d2e4c9aef791ad79b90ed32e05457b40925d8b7',
    '952e45854ca5470a6d0b6cb86346c0e9c4f8f3a5a459657df8c94265183b9253',
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
