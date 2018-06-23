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

const Utilities = require('../../modules/Utilities');
const ImportUtilities = require('../../modules/ImportUtilities');
const Models = require('../../models');
const Storage = require('../../modules/Storage');
const DCService = require('../../modules/DCService');

// Thanks solc. At least this works!
// This removes solc's overzealous uncaughtException event handler.
process.removeAllListeners('uncaughtException');


describe('Protocol tests', () => {
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
                this.imports[importId] = {vertices, edges};
            }
        }

        findEdgesByImportId(importId) {
            return this.imports[importId].vertices;
        }

        findVerticesByImportId(importId) {
            return this.imports[importId].edgeds;
        }
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

        get dcService() {
            return this.container.resolve('dcService');
        }

        get graphStorage() {
            return this.container.resolve('graphStorage');
        }
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

    const ganacheProvider = Ganache.provider({
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
    const web3 = new Web3(ganacheProvider); // Used for deployment and is bound to accounts[0].
    let accounts;
    let tokenContractData;
    let tokenContractAbi;
    let tokenContract;
    let tokenInstance;
    let tokenDeploymentReceipt;
    const tokenSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/TracToken.sol', 'utf8');
    let escrowContractData;
    let escrowContractAbi;
    let escrowContract;
    let escrowInstance;
    let escrowDeploymentReceipt;
    const escrowSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/Escrow.sol', 'utf8');
    let readingContractData;
    let readingContractAbi;
    let readingContract;
    let readingInstance;
    let readingDeploymentReceipt;
    const readingSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/Reading.sol', 'utf8');
    let biddingContractData;
    let biddingContractAbi;
    let biddingContract;
    let biddingInstance;
    let biddingDeploymentReceipt;
    const biddingSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/Bidding.sol', 'utf8');
    let otFingerprintContractData;
    let otFingerprintContractAbi;
    let otFingerprintContract;
    let otFingerprintInstance;
    let otFingerprintDeploymentReceipt;
    const otFingerprintSource = fs.readFileSync('./modules/Blockchain/Ethereum/contracts/OTFingerprintStore.sol', 'utf8');

    const log = Utilities.getLogger();
    const testNodes = [];
    let testNode1;
    let testNode2;
    let testNode3;

    function deployTracTokenContract() {
        return tokenContract.deploy({
            data: tokenContractData,
            arguments: [accounts[0], accounts[1], accounts[2]],
        })
            .send({ from: accounts[0], gas: 3141592 })
            .on('receipt', (receipt) => {
                tokenDeploymentReceipt = receipt;
            })
            .then((instance) => {
                // TODO: ugly workaround - not sure why this is necessary.
                if (!instance._requestManager.provider) {
                    instance._requestManager.setProvider(web3.eth._provider);
                }
                tokenInstance = instance;
            });
    }

    function deployEscrowContract() {
        return escrowContract.deploy({
            data: escrowContractData,
            arguments: [tokenInstance._address],
        })
            .send({ from: accounts[0], gas: 3141592 })
            .on('receipt', (receipt) => {
                escrowDeploymentReceipt = receipt;
            })
            .then((instance) => {
                // TODO: ugly workaround - not sure why this is necessary.
                if (!instance._requestManager.provider) {
                    instance._requestManager.setProvider(web3.eth._provider);
                }
                escrowInstance = instance;
            });
    }

    function deployReadingContract() {
        return readingContract.deploy({
            data: readingContractData,
            arguments: [escrowInstance._address],
        })
            .send({ from: accounts[0], gas: 3141592 })
            .on('receipt', (receipt) => {
                readingDeploymentReceipt = receipt;
            })
            .then((instance) => {
                // TODO: ugly workaround - not sure why this is necessary.
                if (!instance._requestManager.provider) {
                    instance._requestManager.setProvider(web3.eth._provider);
                }
                readingInstance = instance;
            });
    }

    function deployBiddingContract() {
        return biddingContract.deploy({
            data: biddingContractData,
            arguments: [
                tokenInstance._address,
                escrowInstance._address,
                readingInstance._address,
            ],
        })
            .send({ from: accounts[0], gas: 3141592 })
            .on('receipt', (receipt) => {
                biddingDeploymentReceipt = receipt;
            })
            .then((instance) => {
                // TODO: ugly workaround - not sure why this is necessary.
                if (!instance._requestManager.provider) {
                    instance._requestManager.setProvider(web3.eth._provider);
                }
                biddingInstance = instance;
            });
    }

    function deployOtFingerprintContract() {
        return otFingerprintContract.deploy({
            data: otFingerprintContractData,
        })
            .send({ from: accounts[0], gas: 3141592 })
            .on('receipt', (receipt) => {
                otFingerprintDeploymentReceipt = receipt;
            })
            .then((instance) => {
                // TODO: ugly workaround - not sure why this is necessary.
                if (!instance._requestManager.provider) {
                    instance._requestManager.setProvider(web3.eth._provider);
                }
                otFingerprintInstance = instance;
            });
    }

    before('Compile smart contracts source', async function compile() {
        this.timeout(15000);

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
        await deployTracTokenContract();
        await deployEscrowContract();
        await deployReadingContract();
        await deployBiddingContract();
        await deployOtFingerprintContract();

        await escrowInstance.methods.setBidding(biddingInstance._address);
        await escrowInstance.methods.setReading(readingInstance._address);
        await readingInstance.methods.setBidding(biddingInstance._address);
        await readingInstance.methods.transferOwnership(escrowInstance._address);
        await escrowInstance.methods.transferOwnership(biddingInstance._address);

        // Deploy tokens.
        const amountToMint = 5e25;
        const amounts = [];
        const recipients = [];
        for (let i = 0; i < accounts.length; i += 1) {
            amounts.push(amountToMint);
            recipients.push(accounts[i]);
        }
        await tokenInstance.methods.mintMany(recipients, amounts);
        await tokenInstance.methods.finishMinting();
    });

    beforeEach('Recreate database', () => {
        return Models.sequelize.sync({ force: true });
        // TODO: Find solution how to seed the database.
    });

    beforeEach('Register container and build objects', () => {
        // DCService depends on: blockchain, challenger, graphStorage and logger.

        testNodes.forEach((testNode) => {
            const config = {
                node_wallet: testNode.wallet,
                identity: testNode.identity,
                blockchain: {
                    blockchain_title: 'Ethereum',
                    wallet_address: testNode.wallet,
                    wallet_private_key: testNode.walletPrivateKey,
                    ot_contract_address: otFingerprintInstance._address,
                    token_contract_address: tokenInstance._address,
                    escrow_contract_address: escrowInstance._address,
                    bidding_contract_address: biddingInstance._address,
                    reading_contract_address: readingInstance._address,
                    gas_limit: 800000,
                    gas_price: 5000000000,
                },
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
                graphStorage: awilix.asValue(new MockGraphStorage()),
                challenger: awilix.asValue({ startChallennodeWeb3ging: () => { log.info('start challenging.'); } }),
                logger: awilix.asValue(log),
                dcService: awilix.asClass(DCService),
            });

            const blockchain = container.resolve('blockchain');
            const dcService = container.resolve('dcService');

            // Set event listener
            function listenBlockchainEvents() {
                const delay = 10000;
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

            testNode.container = container;
            testNode.eventListener = listenBlockchainEvents();
        });
    });

    afterEach('Unregister container', async () => {
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

    it('should successfully create profile', async () => {
        let profileInfo = await testNode1.blockchain.getProfile(testNode1.wallet);
        expect(profileInfo.active).to.be.false;

        await testNode1.blockchain.createProfile(testNode1.identity, 2, '1', '1', '100000');

        profileInfo = await testNode1.blockchain.getProfile(testNode1.wallet);
        expect(profileInfo.active).to.be.true;

        const events = await biddingInstance.getPastEvents('allEvents', {
            fromBlock: 0,
            toBlock: 'latest',
        });

        expect(events).to.have.lengthOf(1);
        expect(events[0].event).to.equal('ProfileCreated');
        expect(events[0].returnValues).to.have.property('wallet').that.deep.equals(testNode1.wallet);
        expect(events[0].returnValues).to.have.property('node_id').that.deep.equals(testNode1.getIdentityExtended());
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

        beforeEach('Create session profiles', () =>
            Promise.all([
                testNode1.blockchain.createProfile(testNode1.identity, 2, '1', '1', '100000'),
                testNode2.blockchain.createProfile(testNode2.identity, 2, '1', '1', '100000'),
            ]));

        beforeEach('Create one import', async () => {
            mockGraphStorage = testNode1.graphStorage;
            importId = Utilities.createImportId();
            vertices.filter(vertex => vertex.vertex_type !== 'CLASS').forEach(vertex => vertex.imports.push(importId));
            edges.forEach(edge => edge.imports.push(importId));
            mockGraphStorage.imports[importId] = { vertices, edges };
            const merkle = await ImportUtilities.merkleStructure(vertices, edges);
            rootHash = merkle.tree.getRoot();
        });


        it('should initiate replication for happy path and without predetermined bidders', async () => {
            const dcService = testNode1.dcService;
            const blockchain = testNode1.blockchain;

            const offerExternalId =
                await dcService.createOffer(importId, rootHash, 1, vertices);

            // Check for offer in db.
            const offers = await Models.offers.findAll({ where: { import_id: importId } });
            expect(offers).to.have.lengthOf(1);
            const offer = offers[0];
            expect(offer).to.include({
                import_id: importId,
                data_hash: rootHash,
                dh_wallets: '[]',
                dh_ids: '[]',
                status: 'PENDING',
                external_id: offerExternalId,
            });

            await blockchain.subscribeToEvent('OfferCreated', importId, 1000);

            // Send one bid.
            testNode2.blockchain.addBid(importId, testNode2.identity);

            await blockchain.subscribeToEvent('FinalizeOfferReady', importId, 1000);

            // Check for events in the contract.
            const events = await biddingInstance.getPastEvents('allEvents', {
                fromBlock: 0,
                toBlock: 'latest',
            });

            expect(events).to.be.an('arrary').that.includes({ event: 'FinalizeOfferReady', import_id: importId });

            // expect(events).to.have.lengthOf(1);
            // expect(events[0].event).to.equal('ProfileCreated');
            // expect(events[0].returnValues).to.have.property('wallet').that.deep.equals(testNode1.wallet);
            // expect(events[0].returnValues).to.have.property('node_id').that.deep.equals(testNode1.getIdentityExtended());


        });
    });

    // it('should do something', async () => {
    //     console.log('base fucking test', tokenInstance._address);
    //     const dcService = container.resolve('dcService');
    //
    //     await dcService.createOffer('0x00', 'dafa', 100, { vertices: {}, edges: {} });
    // });
});
