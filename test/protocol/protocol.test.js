/* eslint-disable no-unused-expressions, max-len, no-console */
const {
    describe, before, beforeEach, after, afterEach, it,
} = require('mocha');
const { expect } = require('chai');
const Ganache = require('ganache-core');
const Web3 = require('web3');
const awilix = require('awilix');
const Blockchain = require('../../modules/Blockchain');
const solc = require('solc');
const fs = require('fs');
const Umzug = require('umzug');
const BN = require('bn.js');
const sleep = require('sleep-async')().Promise;
const bytes = require('utf8-length');
const logger = require('../../modules/logger');

const Utilities = require('../../modules/Utilities');

const ImportUtilities = require('../../modules/ImportUtilities');
const Models = require('../../models');
const Transactions = require('../../modules/Blockchain/Ethereum/Transactions');

const sequelizeConfig = require('./../../config/sequelizeConfig').development;

const CommandResolver = require('../../modules/command/command-resolver');
const CommandExecutor = require('../../modules/command/command-executor');

const DCService = require('../../modules/service/dc-service');

// Thanks solc. At least this works!
// This removes solc's overzealous uncaughtException event handler.
// process.removeAllListeners('uncaughtException');

describe.skip('Protocol tests', () => {
// Global functions.
    function recreateDatabase() {
        fs.closeSync(fs.openSync(sequelizeConfig.storage, 'w'));

        const migrator = new Umzug({
            storage: 'sequelize',
            storageOptions: {
                sequelize: Models.sequelize,
                tableName: 'migrations',
            },
            logging: logger.debug,
            migrations: {
                params: [Models.sequelize.getQueryInterface(), Models.Sequelize],
                path: `${__dirname}/../../migrations`,
                pattern: /^\d+[\w-]+\.js$/,
            },
        });

        const seeder = new Umzug({
            storage: 'sequelize',
            storageOptions: {
                sequelize: Models.sequelize,
                tableName: 'seeders',
            },
            logging: logger.debug,
            migrations: {
                params: [Models.sequelize.getQueryInterface(), Models.Sequelize],
                path: `${__dirname}/../../seeders`,
                pattern: /^\d+[\w-]+\.js$/,
            },
        });

        return Models.sequelize.authenticate().then(() => migrator.up().then(() => seeder.up()));
    }

    function deployContract(
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
                .send({ from: deployerAddress, gas: 6000000 })
                .on('receipt', (receipt) => {
                    deploymentReceipt = receipt;
                    logger.debug(deploymentReceipt.contractAddress); // contains the new contract address
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

    class MockEmitter {
        constructor() {
            this.events = [];
        }

        emit(eventName, data) {
            this.events.push({ eventName, data });
        }

        getEvents() {
            return this.events;
        }
    }

    class MockGraphStorage {
        constructor(importId, vertices, edges) {
            this.imports = {};
            if (!importId && !vertices && !edges) {
                this.imports[importId] = { vertices, edges };
            }
        }

        findEdgesByImportId(importId) {
            return this.imports[importId].vertices;
        }

        findVerticesByImportId(importId) {
            return this.imports[importId].edges;
        }
    }

    class MockNetwork {
        constructor() {
            this.requests = [];
        }

        kademlia() {
            return this;
        }

        sendVerifyImportResponse(message, nodeId) {
            this.requests.push({ message, nodeId });
        }
    }

    class MockRemoteControl {
        writingRootHash() {}
        initializingOffer() {}
        biddingStarted() {}
        cancelingOffer() {}
        biddingComplete() {}
        choosingBids() {}
        bidChosen() {}
        offerFinalized() {}
        dcErrorHandling() {}
        bidNotTaken() {}
        fingerprintWritten() {}
    }

    class TestNode {
        constructor(identity, wallet, walletPrivateKey) {
            this.identity = identity;
            this.wallet = wallet;
            this.walletPrivateKey = walletPrivateKey;
        }

        getIdentityExtended() {
            return `0x${this.identity}000000000000000000000000`;
        }

        get blockchain() {
            return this.container.resolve('blockchain');
        }

        get graphStorage() {
            return this.container.resolve('graphStorage');
        }

        get network() {
            return this.container.resolve('network');
        }

        get logger() {
            return this.container.resolve('logger');
        }

        get web3() {
            return this.container.resolve('web3');
        }
    }

    function waitForEvent(contract, eventName, importId, timeout = 5000) {
        return new Promise((accept, reject) => {
            const startTime = Date.now();
            const timerHandle = setInterval(async () => {
                if (Date.now() - startTime > timeout) {
                    reject(Error(`Event ${eventName} (${importId}) didn't arrive.`));
                    return;
                }

                const events = await contract.getPastEvents('allEvents', {
                    fromBlock: 0,
                    toBlock: 'latest',
                });

                for (let i = 0; i < events.length; i += 1) {
                    const event = events[i];
                    if (event.event === eventName && !importId) {
                        clearTimeout(timerHandle);
                        accept(event);
                        return;
                    } else if (
                        event.event === eventName && importId &&
                        event.returnValues.import_id === importId
                    ) {
                        clearTimeout(timerHandle);
                        accept(event);
                        return;
                    }
                }
            }, 1000);
        });
    }

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
    ];

    const ganacheProvider =
        Ganache.provider({
            accounts: [
                { secretKey: `0x${accountPrivateKeys[0]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[1]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[2]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[3]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[4]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[5]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[6]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[7]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[8]}`, balance: Web3.utils.toWei('100', 'ether') },
                { secretKey: `0x${accountPrivateKeys[9]}`, balance: Web3.utils.toWei('100', 'ether') },
            ],
        });
    // new Web3.providers.HttpProvider('http://localhost:7545');

    const web3 = new Web3(ganacheProvider); // Used for deployment and is bound to accounts[7].
    let accounts;
    let tokenContractData;
    let tokenContractAbi;
    let tokenContract;
    let tokenInstance;
    let tokenDeploymentReceipt;
    const tokenSource = null;
    // TODO fix
    // const tokenSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/TracToken.sol', 'utf8');
    let escrowContractData;
    let escrowContractAbi;
    let escrowContract;
    let escrowInstance;
    let escrowDeploymentReceipt;
    const escrowSource = null;
    // TODO fix
    // const escrowSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/Escrow.sol', 'utf8');
    let readingContractData;
    let readingContractAbi;
    let readingContract;
    let readingInstance;
    let readingDeploymentReceipt;
    const readingSource = null;
    // TODO fix
    // const readingSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/Reading.sol', 'utf8');
    let biddingContractData;
    let biddingContractAbi;
    let biddingContract;
    let biddingInstance;
    let biddingDeploymentReceipt;
    const biddingSource = null;
    // TODO fix
    // const biddingSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/Bidding.sol', 'utf8');
    let otFingerprintContractData;
    let otFingerprintContractAbi;
    let otFingerprintContract;
    let otFingerprintInstance;
    let otFingerprintDeploymentReceipt;
    const otFingerprintSource = null;
    // TODO fix
    // const otFingerprintSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/OTFingerprintStore.sol', 'utf8');

    const testNodes = [];
    let testNode1;
    let testNode2;
    let testNode3;

    before('Compile smart contracts source', async function compile() {
        this.timeout(20000);

        accounts = await web3.eth.getAccounts();

        testNodes.push(
            new TestNode('d55b78943898105a0d1cddb140f8aeef6d81cfe0', accounts[0], accountPrivateKeys[0]),
            new TestNode('f796e0c221ceef14a3cf9fbd8b995c2a0001fd7d', accounts[1], accountPrivateKeys[1]),
            new TestNode('f8896b195f56040cbbb97f5c1d862a91e1dbc2b1', accounts[2], accountPrivateKeys[2]),
        );

        [testNode1, testNode2, testNode3] = testNodes;

        let compileResult = solc.compile({ sources: { 'TracToken.sol': tokenSource } }, 1);
        tokenContractData = `0x${compileResult.contracts['TracToken.sol:TracToken'].bytecode}`;
        tokenContractAbi = JSON.parse(compileResult.contracts['TracToken.sol:TracToken'].interface);
        tokenContract = new web3.eth.Contract(tokenContractAbi);

        compileResult = solc.compile({ sources: { 'Escrow.sol': escrowSource } }, 1);
        escrowContractData = `0x${compileResult.contracts['Escrow.sol:EscrowHolder'].bytecode}`;
        escrowContractAbi = JSON.parse(compileResult.contracts['Escrow.sol:EscrowHolder'].interface);
        escrowContract = new web3.eth.Contract(escrowContractAbi);

        compileResult = solc.compile({ sources: { 'Reading.sol': readingSource } }, 1);
        readingContractData = `0x${compileResult.contracts['Reading.sol:Reading'].bytecode}`;
        readingContractAbi = JSON.parse(compileResult.contracts['Reading.sol:Reading'].interface);
        readingContract = new web3.eth.Contract(readingContractAbi);

        compileResult = solc.compile({ sources: { 'Bidding.sol': biddingSource } }, 1);
        biddingContractData = `0x${compileResult.contracts['Bidding.sol:Bidding'].bytecode}`;
        biddingContractAbi = JSON.parse(compileResult.contracts['Bidding.sol:Bidding'].interface);
        biddingContract = new web3.eth.Contract(biddingContractAbi);

        compileResult = solc.compile({ sources: { 'OTFingerprintStore.sol': otFingerprintSource } }, 1);
        otFingerprintContractData = `0x${compileResult.contracts['OTFingerprintStore.sol:OTFingerprintStore'].bytecode}`;
        otFingerprintContractAbi = JSON.parse(compileResult.contracts['OTFingerprintStore.sol:OTFingerprintStore'].interface);
        otFingerprintContract = new web3.eth.Contract(otFingerprintContractAbi);
    });

    beforeEach('Deploy new contracts', async function deploy() {
        this.timeout(15000);
        logger.debug('Deploying tokenContract');
        [tokenDeploymentReceipt, tokenInstance] = await deployContract(
            web3, tokenContract, tokenContractData,
            [accounts[7], accounts[8], accounts[9]], accounts[7],
        );
        logger.debug('Deploying escrowContract');
        [escrowDeploymentReceipt, escrowInstance] = await deployContract(
            web3, escrowContract, escrowContractData,
            [tokenInstance._address], accounts[7],
        );
        logger.debug('Deploying readingContract');
        [readingDeploymentReceipt, readingInstance] = await deployContract(
            web3, readingContract, readingContractData,
            [escrowInstance._address], accounts[7],
        );
        logger.debug('Deploying biddingContract');
        [biddingDeploymentReceipt, biddingInstance] = await deployContract(
            web3, biddingContract, biddingContractData,
            [
                tokenInstance._address,
                escrowInstance._address,
                readingInstance._address,
            ], accounts[7],
        );
        logger.debug('Deploying otFingerprintContract');
        [otFingerprintDeploymentReceipt, otFingerprintInstance] = await deployContract(
            web3, otFingerprintContract, otFingerprintContractData,
            undefined, accounts[7],
        );

        await escrowInstance.methods.setBidding(biddingInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
        await escrowInstance.methods.setReading(readingInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
        await readingInstance.methods.setBidding(biddingInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
        await readingInstance.methods.transferOwnership(escrowInstance._address)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
        await escrowInstance.methods.transferOwnership(biddingInstance._address)
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
        await tokenInstance.methods.mintMany(recipients, amounts)
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);

        await tokenInstance.methods.finishMinting()
            .send({ from: accounts[7], gas: 3000000 })
            .on('error', console.error);
    });

    beforeEach('Recreate database', () => recreateDatabase());

    beforeEach('Register container and build objects', () => {
        // DCService depends on: blockchain, challenger, graphStorage and logger.

        testNodes.forEach((testNode) => {
            const config = {
                node_wallet: testNode.wallet,
                node_private_key: testNode.walletPrivateKey,
                identity: testNode.identity,
                blockchain: {
                    blockchain_title: 'Ethereum',
                    ot_contract_address: otFingerprintInstance._address,
                    token_contract_address: tokenInstance._address,
                    escrow_contract_address: escrowInstance._address,
                    bidding_contract_address: biddingInstance._address,
                    reading_contract_address: readingInstance._address,
                    gas_limit: 800000,
                    gas_price: 5000000000,
                },
                dh_min_stake_amount: '100000000000000000', // 1e18 == 1 token
                dh_min_reputation: '0',
            };

            const nodeWeb3 = new Web3(ganacheProvider);

            const container = awilix.createContainer({
                injectionMode: awilix.InjectionMode.PROXY,
            });

            container.register({
                emitter: awilix.asValue(new MockEmitter()),
                config: awilix.asValue(config),
                web3: awilix.asValue(nodeWeb3),
                blockchain: awilix.asClass(Blockchain).singleton(),
                network: awilix.asClass(MockNetwork).singleton(),
                graphStorage: awilix.asValue(new MockGraphStorage()),
                challenger: awilix.asValue({ startChallennodeWeb3ging: () => { logger.info('start challenging.'); } }),
                logger: awilix.asValue(logger),
                remoteControl: awilix.asClass(MockRemoteControl),
                commandExecutor: awilix.asClass(CommandExecutor).singleton(),
                commandResolver: awilix.asClass(CommandResolver).singleton(),
                dcService: awilix.asClass(DCService).singleton(),
            });

            testNode.blockchain = container.resolve('blockchain');
            testNode.commandExecutor = container.resolve('commandExecutor');
            testNode.dcService = container.resolve('dcService');
            testNode.container = container;
        });

        // Let only first node listen to events.
        // TODO
        // Set event listener
        function listenBlockchainEvents(blockchain) {
            const delay = 500;
            let working = false;
            let deadline = Date.now();
            return setInterval(() => {
                if (!working && Date.now() > deadline) {
                    working = true;
                    blockchain.getAllPastEvents('BIDDING_CONTRACT');
                    blockchain.getAllPastEvents('READING_CONTRACT');
                    blockchain.getAllPastEvents('ESCROW_CONTRACT');
                    deadline = Date.now() + delay;
                    working = false;
                }
            }, 500);
        }

        testNode1.eventListener = listenBlockchainEvents(testNode1.blockchain);
    });

    afterEach('Unregister container', async () => {
        logger.debug('Goodbye!');
        testNodes.forEach((testNode) => {
            if (testNode.container) {
                testNode.container.dispose(); // Promise.
                testNode.container = undefined;
            }

            if (testNode.eventListener) {
                clearInterval(testNode.eventListener);
            }
        });
    });

    it.skip('should successfully create profile', async function createProfile() {
        this.timeout(10000);

        let profileInfo = await testNode1.blockchain.getProfile(testNode1.wallet);
        expect(profileInfo.active).to.be.false;

        await testNode1.blockchain.createProfile(testNode1.identity, 2, '1', '1', '100000');

        profileInfo = await testNode1.blockchain.getProfile(testNode1.wallet);
        expect(profileInfo.active).to.be.true;
        expect(profileInfo.token_amount_per_byte_minute).to.be.equal('2');
        expect(profileInfo.stake_amount_per_byte_minute).to.be.equal('1');
        expect(profileInfo.read_stake_factor).to.be.equal('1');
        expect(profileInfo.max_escrow_time_in_minutes).to.be.equal('100000');

        const events = await biddingInstance.getPastEvents('allEvents', {
            fromBlock: 0,
            toBlock: 'latest',
        });

        expect(events).to.have.lengthOf(1);
        expect(events[0].event).to.equal('ProfileCreated');
        expect(events[0].returnValues).to.have.property('wallet').that.deep.equals(testNode1.wallet);
        expect(events[0].returnValues).to.have.property('node_id').that.deep.equals(testNode1.getIdentityExtended());
        expect(events[0].address).to.be.equal(biddingInstance._address);
    });

    describe('Transaction object tests', () => {
        it.skip('should successfully run a transaction', async () => {
            const transactions = new Transactions(testNode1.web3, testNode1.wallet, testNode1.walletPrivateKey);
            const options = {
                gasLimit: web3.utils.toHex(testNode1.blockchain.config.gas_limit),
                gasPrice: web3.utils.toHex(testNode1.blockchain.config.gas_price),
                to: tokenInstance._address,
            };
            await transactions.queueTransaction(
                tokenContractAbi,
                'increaseApproval',
                [biddingInstance._address, '10'],
                options,
            );
            options.to = biddingInstance._address;

            // console.log(await tokenInstance.methods.allowance(testNode1.wallet, escrowInstance._address).call());
            await transactions.queueTransaction(biddingContractAbi, 'depositToken', ['1'], options);
        });

        it.skip('should fail a transaction', async () => {
            const nonceFakerWeb3 = new Web3(ganacheProvider);
            const lastKnownNonce = await nonceFakerWeb3.eth.getTransactionCount(testNode1.wallet);
            nonceFakerWeb3.eth.getTransactionCount = async () => lastKnownNonce;

            const transactions = new Transactions(nonceFakerWeb3, testNode1.wallet, testNode1.walletPrivateKey);
            const options = {
                gasLimit: web3.utils.toHex(testNode1.blockchain.config.gas_limit),
                gasPrice: web3.utils.toHex(testNode1.blockchain.config.gas_price),
                to: tokenInstance._address,
            };
            await transactions.queueTransaction(
                tokenContractAbi,
                'increaseApproval',
                [biddingInstance._address, '10'],
                options,
            );

            // Expect nonce too low since it will be lastKnownNonce + 1 again.
            try {
                await transactions.queueTransaction(
                    tokenContractAbi,
                    'increaseApproval',
                    [biddingInstance._address, '10'],
                    options,
                );
            } catch (error) {
                if (error.name === 'TransactionFailedError' && error.constructor.name === 'TransactionFailedError') {
                    return;
                }
            }
            throw Error('Transaction expected to fail.');
        }).timeout(10000);
    });

    describe('DC replication', () => {
        const vertices = [
            {
                _id: '247d8e3809b448fe8f5b67495801e246',
                _key: '247d8e3809b448fe8f5b67495801e246',
                identifiers: {
                    id: 'urn:epc:id:sgln:Building_2',
                    uid: 'urn:epc:id:sgln:Building_2',
                },
                data: {
                    category: 'Building _2b',
                    description: 'Description of building _2b',
                    object_class_id: 'Location',
                },
                private: {},
                vertex_type: 'LOCATION',
                sender_id: 'urn:ot:object:actor:id:Company_2',
                version: 1,
                imports: [],
            },
            {
                _id: 'Location',
                _key: 'Location',
                vertex_type: 'CLASS',
            },
        ];
        const edges = [
            {
                _id: 'af54d5a366006fa21dcbf4df50421165',
                _key: '_key:af54d5a366006fa21dcbf4df50421165',
                _from: '247d8e3809b448fe8f5b67495801e246',
                _to: 'Location',
                edge_type: 'IS',
                sender_id: 'urn:ot:object:actor:id:Company_2',
                imports: [],
            },
        ];

        let importId;
        let rootHash;
        let mockGraphStorage;

        beforeEach('Create session profiles', function createSessionProfiles() {
            this.timeout(6000);
            return Promise.all([
                testNode1.blockchain.createProfile(
                    testNode1.identity,
                    '100000000000000000',
                    '100000000000000000',
                    '100000',
                    '100000',
                ),
                testNode2.blockchain.createProfile(
                    testNode2.identity,
                    '100000000000000000',
                    '100000000000000000',
                    '100000',
                    '100000',
                ),
            ]);
        });

        beforeEach('Create one import', async () => {
            mockGraphStorage = testNode1.graphStorage;
            importId = Utilities.createImportId(testNode1.wallet);
            vertices.filter(vertex => vertex.vertex_type !== 'CLASS').forEach(vertex => vertex.imports.push(importId));
            edges.forEach(edge => edge.imports.push(importId));
            mockGraphStorage.imports[importId] = { vertices, edges };
            const merkle = await ImportUtilities.merkleStructure(vertices, edges);
            rootHash = merkle.tree.getRoot();
            const normalized = ImportUtilities.normalizeImport(
                vertices,
                edges,
            );
            const importHash = ImportUtilities.importHash(
                importId,
                normalized.vertices,
                normalized.edges,
            );

            Models.data_info.create({
                import_id: importId,
                root_hash: rootHash,
                import_hash: importHash,
                data_provider_wallets: JSON.stringify([{
                    wallet: Utilities.normalizeHex(testNode1.wallet),
                    blockchain_id: 'testing',
                }]),
                import_timestamp: new Date(),
                total_documents: vertices.length,
                data_size: bytes(JSON.stringify(vertices)),
                transaction_hash: null,
            });
        });


        it.skip('should initiate replication for happy path and without predetermined bidders', async function replication1() {
            this.timeout(90000); // One minute is minimum time for a offer.
            const { dcService, blockchain } = testNode1;

            const replicationId = await dcService.createOffer(importId, rootHash, 1);

            const event = await waitForEvent(biddingInstance, 'OfferCreated', importId, 60000);
            expect(event).to.exist;

            // Check for offer in db.
            const offers = await Models.offers.findAll({ where: { import_id: importId } });
            expect(offers).to.have.lengthOf(1);
            const offer = offers[0];
            expect(offer).to.include({
                import_id: importId,
                data_hash: rootHash,
                // TODO: find solution for testing arrays in 'expect'.
                // dh_wallets: [],
                // dh_ids: [],
                status: 'STARTED',
                external_id: replicationId,
            });
            expect(offer.dh_wallets).to.be.an('array').deep.equal([]);
            expect(offer.dh_ids).to.be.an('array').deep.equal([]);

            // Send one bid.
            const bidderDeposit = new BN('100000000000000000', 10)
                .mul(new BN(ImportUtilities.calculateEncryptedImportSize(vertices)));
            await testNode2.blockchain.increaseBiddingApproval(bidderDeposit);
            await testNode2.blockchain.depositTokens(bidderDeposit);
            await testNode2.blockchain.addBid(importId, testNode2.identity);

            await waitForEvent(biddingInstance, 'FinalizeOfferReady', importId, 5000);

            // Check for events in the contract.
            let events = await biddingInstance.getPastEvents('allEvents', {
                fromBlock: 0,
                toBlock: 'latest',
            });

            expect(events).to.be.an('array');
            const finalizeOfferReadyEvent = events.find(event => event.event === 'FinalizeOfferReady');
            expect(finalizeOfferReadyEvent.returnValues).to.have.property('import_id').that.deep.equals(importId);

            await waitForEvent(biddingInstance, 'OfferFinalized', importId, 60000);
            events = await biddingInstance.getPastEvents('allEvents', {
                fromBlock: 0,
                toBlock: 'latest',
            });

            expect(events).to.be.an('array');
            const offerFinalizedEvent = events.find(event => event.event === 'OfferFinalized');
            expect(finalizeOfferReadyEvent.returnValues).to.have.property('import_id').that.deep.equals(importId);

            await waitForEvent(biddingInstance, 'BidTaken', importId, 10000);
            events = await biddingInstance.getPastEvents('allEvents', {
                fromBlock: 0,
                toBlock: 'latest',
            });

            expect(events).to.be.an('array');
            const bidTakenEvent = events.find(event => event.event === 'BidTaken');
            logger.debug(JSON.stringify(events));
            expect(bidTakenEvent.returnValues).to.have.property('import_id').that.deep.equals(importId);
            expect(bidTakenEvent.returnValues).to.have.property('DH_wallet').that.deep.equals(testNode2.wallet);

            for (;;) {
                // eslint-disable-next-line no-await-in-loop
                const offer = await Models.offers.findOne({ where: { import_id: importId } });

                if (offer.status === 'FINALIZED') {
                    return;
                }
                if (offer.status === 'FAILED') {
                    throw Error('Failed to create offer.');
                }
                // eslint-disable-next-line no-await-in-loop
                await sleep.sleep(500);
            }
        });

        it.skip('rootHash for already imported data should exist on blockchain', async function () {
            this.timeout(90000); // One minute is minimum time for a offer.
            const { dcService, blockchain } = testNode1;

            await dcService.createOffer(importId, rootHash, 1, vertices);
            await waitForEvent(biddingInstance, 'OfferCreated', importId, 60000);

            // Send one bid.
            const bidderDeposit = new BN('100000000000000000', 10)
                .mul(new BN(ImportUtilities.calculateEncryptedImportSize(vertices)));
            await testNode2.blockchain.increaseBiddingApproval(bidderDeposit);
            await testNode2.blockchain.depositTokens(bidderDeposit);
            await testNode2.blockchain.addBid(importId, testNode2.identity);

            await waitForEvent(biddingInstance, 'FinalizeOfferReady', importId, 5000);
            await waitForEvent(biddingInstance, 'OfferFinalized', importId, 60000);
            await waitForEvent(biddingInstance, 'BidTaken', importId, 10000);

            for (;;) {
                // eslint-disable-next-line no-await-in-loop
                const offer = await Models.offers.findOne({ where: { import_id: importId } });

                if (offer.status === 'FINALIZED' || offer.status === 'FAILED') {
                    break;
                }
                // eslint-disable-next-line no-await-in-loop
                await sleep.sleep(500);
            }

            const result2 = await testNode2.blockchain.getRootHash(testNode1.wallet, importId).response;
            expect(result2).to.not.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
            expect(Utilities.isHexStrict(result2)).to.be.true;

            const result1 = await testNode1.blockchain.getRootHash(testNode1.wallet, importId).response;
            expect(result1).to.be.equal(result2);
        });
    });
});
