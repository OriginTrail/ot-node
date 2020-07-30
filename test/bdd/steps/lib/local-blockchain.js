/* eslint-disable max-len */
const Ganache = require('ganache-core');
const Web3 = require('web3');
const solc = require('solc');
const fs = require('fs');
const path = require('path');
const EthWallet = require('ethereumjs-wallet');
const assert = require('assert');

const utilities = require('./utilities');
const Utilities = require('../../../../modules/Utilities');

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

/**
 * LocalBlockchain represent small wrapper around the Ganache.
 *
 * LocalBlockchain uses the Ganache-core to run in-memory blockchain simulator. It uses
 * predefined accounts that can be fetch by calling LocalBlockchain.wallets(). Account with
 * index 7 is used for deploying contracts.
 *
 * Basic usage:
 * LocalBlockchain.wallets()[9].address
 * LocalBlockchain.wallets()[9].privateKey,
 *
 * const localBlockchain = new LocalBlockchain({ logger: this.logger });
 * await localBlockchain.initialize(); // Init the server.
 * // That will compile and deploy contracts. Later can be called
 * // deployContracts() to re-deploy fresh contracts.
 *
 * // After usage:
 *     if (localBlockchain.server) {
 *         this.state.localBlockchain.server.close();
 *     }
 *
 * @param {String} [options.logger] - Logger instance with debug, trace, info and error methods.
 */
class LocalBlockchain {
    constructor(options = {}) {
        this.logger = options.logger || console;
        this.server = Ganache.server({
            gasLimit: 7000000,
            time: new Date(),
            accounts:
                accountPrivateKeys.map(account => ({
                    secretKey: `0x${account}`,
                    balance: Web3.utils.toWei('100', 'ether'),
                })),
        });
        this.initialized = false;
    }

    async initialize() {
        return new Promise((accept, reject) => {
            this.server.listen(7545, async (err, blockchain) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.logger.info('Blockchain is up at http://localhost:7545/');
                // TODO: Use url from server.
                this.web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
                this.compileContracts();
                await this.deployContracts();
                assert(this.hubContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.approvalContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.profileStorageContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.holdingStorageContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.tokenContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.profileContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.creditorHandlerContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.holdingContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.readingContractAddress !== '0x0000000000000000000000000000000000000000');
                assert(this.litigationContractAddress !== '0x0000000000000000000000000000000000000000');
                accept();
            });
        });
    }

    compileContracts() {
        const hubSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Hub.sol'), 'utf8');
        const approvalSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Approval.sol'), 'utf8');
        const profileStorageSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/ProfileStorage.sol'), 'utf8');
        const holdingStorageSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/HoldingStorage.sol'), 'utf8');
        const tokenSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/TracToken.sol'), 'utf8');
        const profileSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Profile.sol'), 'utf8');
        const holdingSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Holding.sol'), 'utf8');
        const creditorHandlerSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/CreditorHandler.sol'), 'utf8');
        const readingSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Reading.sol'), 'utf8');
        const eRC725Source = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/ERC725.sol'), 'utf8');
        const safeMathSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/SafeMath.sol'), 'utf8');
        const identitySource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Identity.sol'), 'utf8');
        const byteArrSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/ByteArr.sol'), 'utf8');
        const litigationSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Litigation.sol'), 'utf8');
        const litigationStorageSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/LitigationStorage.sol'), 'utf8');
        const replacementSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Replacement.sol'), 'utf8');
        const marketplaceStorageSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/MarketplaceStorage.sol'), 'utf8');
        const marketplaceSource = fs.readFileSync(path.join(__dirname, '../../../../modules/Blockchain/Ethereum/contracts/Marketplace.sol'), 'utf8');

        this.contracts = {};

        let compileResult = solc.compile({ sources: { 'Hub.sol': hubSource } }, 1);
        this.contracts.Hub = {};
        this.contracts.Hub.data = `0x${compileResult.contracts['Hub.sol:Hub'].bytecode}`;
        this.contracts.Hub.abi = JSON.parse(compileResult.contracts['Hub.sol:Hub'].interface);
        this.contracts.Hub.artifact = new this.web3.eth.Contract(this.contracts.Hub.abi);

        compileResult = solc.compile({
            sources: {
                'Approval.sol': approvalSource,
                'ProfileStorage.sol': profileStorageSource,
                'TracToken.sol': tokenSource,
                'Hub.sol': hubSource,
                'HoldingStorage.sol': holdingStorageSource,
                'Reading.sol': readingSource,
                'Profile.sol': profileSource,
                'Holding.sol': holdingSource,
                'CreditorHandler.sol': creditorHandlerSource,
                'ERC725.sol': eRC725Source,
                'SafeMath.sol': safeMathSource,
                'Identity.sol': identitySource,
                'ByteArr.sol': byteArrSource,
                'Litigation.sol': litigationSource,
                'LitigationStorage.sol': litigationStorageSource,
                'Replacement.sol': replacementSource,
                'MarketplaceStorage.sol': marketplaceStorageSource,
                'Marketplace.sol': marketplaceSource,
            },
        }, 1);

        this.contracts.Approval = {};
        this.contracts.Approval.data = `0x${compileResult.contracts['Approval.sol:Approval'].bytecode}`;
        this.contracts.Approval.abi = JSON.parse(compileResult.contracts['Approval.sol:Approval'].interface);
        this.contracts.Approval.artifact = new this.web3.eth.Contract(this.contracts.Approval.abi);

        this.contracts.ProfileStorage = {};
        this.contracts.ProfileStorage.data = `0x${compileResult.contracts['ProfileStorage.sol:ProfileStorage'].bytecode}`;
        this.contracts.ProfileStorage.abi = JSON.parse(compileResult.contracts['ProfileStorage.sol:ProfileStorage'].interface);
        this.contracts.ProfileStorage.artifact = new this.web3.eth.Contract(this.contracts.ProfileStorage.abi);

        this.contracts.HoldingStorage = {};
        this.contracts.HoldingStorage.data = `0x${compileResult.contracts['HoldingStorage.sol:HoldingStorage'].bytecode}`;
        this.contracts.HoldingStorage.abi = JSON.parse(compileResult.contracts['HoldingStorage.sol:HoldingStorage'].interface);
        this.contracts.HoldingStorage.artifact = new this.web3.eth.Contract(this.contracts.HoldingStorage.abi);

        this.contracts.Token = {};
        this.contracts.Token.data = `0x${compileResult.contracts['TracToken.sol:TracToken'].bytecode}`;
        this.contracts.Token.abi = JSON.parse(compileResult.contracts['TracToken.sol:TracToken'].interface);
        this.contracts.Token.artifact = new this.web3.eth.Contract(this.contracts.Token.abi);

        this.contracts.Profile = {};
        this.contracts.Profile.data = `0x${compileResult.contracts['Profile.sol:Profile'].bytecode}`;
        this.contracts.Profile.abi = JSON.parse(compileResult.contracts['Profile.sol:Profile'].interface);
        this.contracts.Profile.artifact = new this.web3.eth.Contract(this.contracts.Profile.abi);

        this.contracts.Holding = {};
        this.contracts.Holding.data = `0x${compileResult.contracts['Holding.sol:Holding'].bytecode}`;
        this.contracts.Holding.abi = JSON.parse(compileResult.contracts['Holding.sol:Holding'].interface);
        this.contracts.Holding.artifact = new this.web3.eth.Contract(this.contracts.Holding.abi);

        this.contracts.CreditorHandler = {};
        this.contracts.CreditorHandler.data = `0x${compileResult.contracts['CreditorHandler.sol:CreditorHandler'].bytecode}`;
        this.contracts.CreditorHandler.abi = JSON.parse(compileResult.contracts['CreditorHandler.sol:CreditorHandler'].interface);
        this.contracts.CreditorHandler.artifact = new this.web3.eth.Contract(this.contracts.CreditorHandler.abi);

        this.contracts.Reading = {};
        this.contracts.Reading.data = `0x${compileResult.contracts['Reading.sol:Reading'].bytecode}`;
        this.contracts.Reading.abi = JSON.parse(compileResult.contracts['Reading.sol:Reading'].interface);
        this.contracts.Reading.artifact = new this.web3.eth.Contract(this.contracts.Reading.abi);

        this.contracts.LitigationStorage = {};
        this.contracts.LitigationStorage.data = `0x${compileResult.contracts['LitigationStorage.sol:LitigationStorage'].bytecode}`;
        this.contracts.LitigationStorage.abi = JSON.parse(compileResult.contracts['LitigationStorage.sol:LitigationStorage'].interface);
        this.contracts.LitigationStorage.artifact = new this.web3.eth.Contract(this.contracts.LitigationStorage.abi);

        this.contracts.Litigation = {};
        this.contracts.Litigation.data = `0x${compileResult.contracts['Litigation.sol:Litigation'].bytecode}`;
        this.contracts.Litigation.abi = JSON.parse(compileResult.contracts['Litigation.sol:Litigation'].interface);
        this.contracts.Litigation.artifact = new this.web3.eth.Contract(this.contracts.Litigation.abi);

        this.contracts.Replacement = {};
        this.contracts.Replacement.data = `0x${compileResult.contracts['Replacement.sol:Replacement'].bytecode}`;
        this.contracts.Replacement.abi = JSON.parse(compileResult.contracts['Replacement.sol:Replacement'].interface);
        this.contracts.Replacement.artifact = new this.web3.eth.Contract(this.contracts.Replacement.abi);

        this.contracts.Identity = {};
        this.contracts.Identity.data = `0x${compileResult.contracts['Identity.sol:Identity'].bytecode}`;
        this.contracts.Identity.abi = JSON.parse(compileResult.contracts['Identity.sol:Identity'].interface);
        this.contracts.Identity.artifact = new this.web3.eth.Contract(this.contracts.Identity.abi);


        this.contracts.MarketplaceStorage = {};
        this.contracts.MarketplaceStorage.data = `0x${compileResult.contracts['MarketplaceStorage.sol:MarketplaceStorage'].bytecode}`;
        this.contracts.MarketplaceStorage.abi = JSON.parse(compileResult.contracts['MarketplaceStorage.sol:MarketplaceStorage'].interface);
        this.contracts.MarketplaceStorage.artifact = new this.web3.eth.Contract(this.contracts.MarketplaceStorage.abi);

        this.contracts.Marketplace = {};
        this.contracts.Marketplace.data = `0x${compileResult.contracts['Marketplace.sol:Marketplace'].bytecode}`;
        this.contracts.Marketplace.abi = JSON.parse(compileResult.contracts['Marketplace.sol:Marketplace'].interface);
        this.contracts.Marketplace.artifact = new this.web3.eth.Contract(this.contracts.Marketplace.abi);
    }

    async deployContracts() {
        const accounts = await this.web3.eth.getAccounts();
        this.logger.log('Deploying hubContract');
        [this.contracts.Hub.deploymentReceipt, this.contracts.Hub.instance] = await this._deployContract(
            this.web3, this.contracts.Hub.artifact, this.contracts.Hub.data,
            [], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Owner', accounts[7])
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying approvalContract');
        [this.contracts.Approval.deploymentReceipt, this.contracts.Approval.instance] = await this._deployContract(
            this.web3, this.contracts.Approval.artifact, this.contracts.Approval.data,
            [], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Approval', this.contracts.Approval.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying profileStorageContract');
        [this.contracts.ProfileStorage.deploymentReceipt, this.contracts.ProfileStorage.instance] = await this._deployContract(
            this.web3, this.contracts.ProfileStorage.artifact, this.contracts.ProfileStorage.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('ProfileStorage', this.contracts.ProfileStorage.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);


        this.logger.log('Deploying holdingStorageContract');
        [this.contracts.HoldingStorage.deploymentReceipt, this.contracts.HoldingStorage.instance] = await this._deployContract(
            this.web3, this.contracts.HoldingStorage.artifact, this.contracts.HoldingStorage.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('HoldingStorage', this.contracts.HoldingStorage.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying Token contract');
        [this.contracts.Token.deploymentReceipt, this.contracts.Token.instance] = await this._deployContract(
            this.web3, this.contracts.Token.artifact, this.contracts.Token.data,
            [accounts[7], accounts[8], accounts[9]], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Token', this.contracts.Token.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying Profile contract');
        [this.contracts.Profile.deploymentReceipt, this.contracts.Profile.instance] = await this._deployContract(
            this.web3, this.contracts.Profile.artifact, this.contracts.Profile.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Profile', this.contracts.Profile.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying Holding contract');
        [this.contracts.Holding.deploymentReceipt, this.contracts.Holding.instance] = await this._deployContract(
            this.web3, this.contracts.Holding.artifact, this.contracts.Holding.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Holding', this.contracts.Holding.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying CreditorHandler contract');
        [this.contracts.CreditorHandler.deploymentReceipt, this.contracts.CreditorHandler.instance] = await this._deployContract(
            this.web3, this.contracts.CreditorHandler.artifact, this.contracts.CreditorHandler.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('CreditorHandler', this.contracts.CreditorHandler.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);


        this.logger.log('Deploying Reading contract');
        [this.contracts.Reading.deploymentReceipt, this.contracts.Reading.instance] = await this._deployContract(
            this.web3, this.contracts.Reading.artifact, this.contracts.Reading.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Reading', this.contracts.Reading.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying LitigationStorage contract');
        [this.contracts.LitigationStorage.deploymentReceipt, this.contracts.LitigationStorage.instance] = await this._deployContract(
            this.web3, this.contracts.LitigationStorage.artifact, this.contracts.LitigationStorage.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('LitigationStorage', this.contracts.LitigationStorage.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying Litigation contract');
        [this.contracts.Litigation.deploymentReceipt, this.contracts.Litigation.instance] = await this._deployContract(
            this.web3, this.contracts.Litigation.artifact, this.contracts.Litigation.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Litigation', this.contracts.Litigation.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying Replacement contract');
        [this.contracts.Replacement.deploymentReceipt, this.contracts.Replacement.instance] = await this._deployContract(
            this.web3, this.contracts.Replacement.artifact, this.contracts.Replacement.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Replacement', this.contracts.Replacement.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.logger.log('Deploying MarketplaceStorage contract');
        [this.contracts.MarketplaceStorage.deploymentReceipt, this.contracts.MarketplaceStorage.instance] = await this._deployContract(
            this.web3, this.contracts.MarketplaceStorage.artifact, this.contracts.MarketplaceStorage.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('MarketplaceStorage', this.contracts.MarketplaceStorage.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);


        this.logger.log('Deploying Marketplace contract');
        [this.contracts.Marketplace.deploymentReceipt, this.contracts.Marketplace.instance] = await this._deployContract(
            this.web3, this.contracts.Marketplace.artifact, this.contracts.Marketplace.data,
            [this.contracts.Hub.instance._address], accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress('Marketplace', this.contracts.Marketplace.instance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        // Deploy tokens.
        const amountToMint = '50000000000000000000000000'; // 5e25
        const amounts = [];
        const recipients = [];
        for (let i = 0; i < accounts.length; i += 1) {
            amounts.push(amountToMint);
            recipients.push(accounts[i]);
        }
        await this.contracts.Token.instance.methods.mintMany(recipients, amounts)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        await this.contracts.Token.instance.methods.finishMinting()
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.initialized = true;
    }

    async _deployContract(
        web3,
        contract,
        contractData,
        constructorArguments,
        deployerAddress,
    ) {
        let deploymentReceipt;
        let contractInstance;
        return new Promise((accept, reject) => {
            contract.deploy({
                data: contractData,
                arguments: constructorArguments,
            })
                .send({ from: deployerAddress, gas: 6900000 })
                .on('receipt', (receipt) => {
                    deploymentReceipt = receipt;
                })
                .on('error', error => reject(error))
                .then((instance) => {
                    // TODO: ugly workaround - not sure why this is necessary.
                    if (!instance._requestManager.provider) {
                        instance._requestManager.setProvider(web3.eth._provider);
                    }
                    contractInstance = instance;
                    accept([deploymentReceipt, contractInstance]);
                });
        });
    }

    async _getConstructorArguments(contractName) {
        const accounts = await this.web3.eth.getAccounts();

        switch (contractName) {
        case 'Hub':
        case 'Approval':
            return [];
        case 'Token':
            return [accounts[7], accounts[8], accounts[9]];
        default:
            return [this.contracts.Hub.instance._address];
        }
    }


    async deployContract(contractName) {
        const contract = this.contracts[contractName.toLowerCase()];
        if (!contract) {
            throw new Error(`Required artifacts not found for the ${contractName} contract`);
        }

        const accounts = await this.web3.eth.getAccounts();

        this.logger.log(`Deploying new ${contractName} contract`);
        const [deploymentReceipt, instance] = await this._deployContract(
            this.web3,
            contract.artifact,
            contract.data,
            await this._getConstructorArguments(contractName.toLowerCase()),
            accounts[7],
        );

        await this.contracts.Hub.instance.methods.setContractAddress(
            contractName,
            instance._address,
        )
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        contract.deploymentReceipt = deploymentReceipt;
        contract.instance = instance;
    }


    async moveContract(contractName, newName) {
        const contract = this.contracts[contractName];
        if (!contract) {
            throw new Error(`Required artifacts not found for the ${contractName} contract.`);
        }

        const accounts = await this.web3.eth.getAccounts();

        await this.contracts.Hub.instance.methods.setContractAddress(
            newName,
            contract.instance._address,
        )
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        this.contracts[newName] = Utilities.copyObject(contract);
    }

    get hubContractAddress() {
        return this.contracts.Hub.instance._address;
    }

    get approvalContractAddress() {
        return this.contracts.Approval.instance._address;
    }

    get profileStorageContractAddress() {
        return this.contracts.ProfileStorage.instance._address;
    }

    get holdingStorageContractAddress() {
        return this.contracts.HoldingStorage.instance._address;
    }

    get tokenContractAddress() {
        return this.contracts.Token.instance._address;
    }

    get profileContractAddress() {
        return this.contracts.Profile.instance._address;
    }

    get holdingContractAddress() {
        return this.contracts.Holding.instance._address;
    }

    get readingContractAddress() {
        return this.contracts.Reading.instance._address;
    }

    get litigationContractAddress() {
        return this.contracts.Litigation.instance._address;
    }

    get isInitialized() {
        return this.initialized;
    }

    static wallets() {
        return wallets;
    }

    async getBalanceInEthers(wallet) {
        return this.web3.eth.getBalance(wallet);
    }

    async createIdentity(wallet, walletKey, managementWallet) {
        const [, identityInstance] = await this._deployContract(
            this.web3, this.contracts.Identity.artifact, this.contracts.Identity.data,
            [wallet, managementWallet], wallet,
        );
        return identityInstance;
    }
}

module.exports = LocalBlockchain;
