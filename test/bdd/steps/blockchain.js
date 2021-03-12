/* eslint-disable prefer-arrow-callback */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { expect } = require('chai');
const BN = require('bn.js');
const path = require('path');
const fs = require('fs');

const LocalBlockchain = require('./lib/local-blockchain');

Given(/^the blockchain is set up$/, { timeout: 60000 }, function (done) {
    expect(this.state.localBlockchain, 'localBlockchain shouldn\'t be defined').to.be.equal(null);

    this.state.localBlockchain = new LocalBlockchain({ logger: this.logger });
    this.state.localBlockchain.initialize().then(() => {
        done();
    }).catch(error => done(error));
});


Given(/^the blockchains are set up$/, { timeout: 60000 }, async function () {
    expect(this.state.localBlockchain, 'localBlockchain shouldn\'t be defined').to.be.equal(null);

    this.state.localBlockchain = [];
    this.state.localBlockchain[0] = new LocalBlockchain({ logger: this.logger, port: 7545, name: 'ganache_7545' });
    this.state.localBlockchain[1] = new LocalBlockchain({ logger: this.logger, port: 8545, name: 'ganache_8545' });

    const promises = [];
    for (const blockchain of this.state.localBlockchain) {
        promises.push(blockchain.initialize());
    }
    await Promise.all(promises);
});

Given(/^the replication difficulty is (\d+)$/, async function (difficulty) {
    this.logger.log(`The replication difficulty is ${difficulty}`);
    expect(this.state.localBlockchain, 'localBlockchain is not an array').to.be.an('array');
    expect(this.state.localBlockchain, 'localBlockchain is not an array').to.have.lengthOf(2);

    for (const blockchain of this.state.localBlockchain) {
        expect(blockchain.isInitialized, 'localBlockchain not initialized').to.be.equal(true);

        let currentDifficulty =
            // eslint-disable-next-line no-await-in-loop
            await blockchain.contracts.HoldingStorage.instance.methods.difficultyOverride().call();

        if (currentDifficulty !== difficulty.toString()) {
            this.logger.log(`Changing difficulty modifier to ${difficulty}.`);
            // eslint-disable-next-line no-await-in-loop
            await blockchain.contracts.HoldingStorage.instance.methods
                .setDifficultyOverride(difficulty).send({
                    // TODO: Add access to original wallet.
                    // eslint-disable-next-line no-await-in-loop
                    from: (await blockchain.web3.eth.getAccounts())[7],
                    gas: 3000000,
                }).on('error', (error) => { throw error; });

            // eslint-disable-next-line no-await-in-loop
            currentDifficulty = await blockchain.contracts.HoldingStorage.instance.methods
                .difficultyOverride().call();

            expect(currentDifficulty).to.be.equal(difficulty.toString());
        }
    }
});

Given(/^the (\d+)[st|nd|rd|th]+ node's spend all the (Ethers|Tokens)$/, async function (nodeIndex, currencyType) {
    this.logger.log(`The ${nodeIndex} node's spend all the ${currencyType}`);
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);
    expect(currencyType).to.be.oneOf(['Ethers', 'Tokens']);

    const node = this.state.nodes[nodeIndex - 1];
    const blockchain = Array.isArray(this.state.localBlockchain) ?
        this.state.localBlockchain[0] : this.state.localBlockchain;
    const { web3 } = blockchain;
    const targetWallet = web3.eth.accounts.create();

    const nodeWalletPath = path.join(
        node.options.configDir,
        node.options.nodeConfiguration.blockchain.implementations[0].node_wallet_path,
    );
    const nodeWallet = JSON.parse(fs.readFileSync(nodeWalletPath, 'utf8')).node_wallet;

    if (currencyType === 'Ethers') {
        const balance = await blockchain.getBalanceInEthers(nodeWallet);
        const balanceBN = new BN(balance, 10);
        const toSend = balanceBN.sub(new BN(await web3.eth.getGasPrice(), 10).mul(new BN(21000)));
        await web3.eth.sendTransaction({
            to: targetWallet.address,
            from: nodeWallet,
            value: toSend,
            gas: 21000,
            gasPrice: await web3.eth.getGasPrice(),
        });
        expect(await blockchain.getBalanceInEthers(nodeWallet)).to.equal('0');
    } else if (currencyType === 'Tokens') {
        const balance =
            await blockchain.contracts.Token.instance.methods
                .balanceOf(nodeWallet).call();

        await blockchain.contracts.Token.instance.methods
            .transfer(targetWallet.address, balance)
            .send({ from: nodeWallet, gas: 3000000 });
        expect(await blockchain.contracts.Token.instance.methods
            .balanceOf(nodeWallet).call()).to.equal('0');
    }
});


Given(/^I set the (.+) contract as (.+)$/, async function (contractName, newName) {
    this.logger.log(`I set the ${contractName} contract as ${newName}`);
    try {
        await this.state.localBlockchain.moveContract(contractName, newName);
    } catch (error) {
        expect(false, error.message);
    }
});


Given(/^I deploy a new (.+) contract$/, async function (contractName) {
    this.logger.log(`I deploy a new  ${contractName} contract`);
    try {
        await this.state.localBlockchain.deployContract(contractName);
    } catch (error) {
        expect(false, error.message);
    }
});


Then(/^the (\d+)[st|nd|rd|th]+ node should fail to initialize a profile$/, { timeout: 20000 }, function (nodeIndex, done) {
    this.logger.log(`The ${nodeIndex} node should fail to initialize a profile`);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);
    expect(this.state.bootstraps.length).to.be.greaterThan(0);
    expect(this.state.nodes.length).to.be.greaterThan(0);

    const node = this.state.nodes[nodeIndex - 1];

    const initializePromise = new Promise((accept, reject) => {
        node.once('profile-initialize-failed', () => accept());
        node.once('error', () => reject());
    });

    initializePromise.then(() => done());
});
