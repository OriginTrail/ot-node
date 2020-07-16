/* eslint-disable prefer-arrow-callback */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { expect } = require('chai');
const BN = require('bn.js');

const LocalBlockchain = require('./lib/local-blockchain');

Given(/^the blockchain is set up$/, { timeout: 60000 }, function (done) {
    expect(this.state.localBlockchain, 'localBlockchain shouldn\'t be defined').to.be.equal(null);

    this.state.localBlockchain = new LocalBlockchain({ logger: this.logger });
    this.state.localBlockchain.initialize().then(() => {
        done();
    }).catch(error => done(error));
});

Given(/^the replication difficulty is (\d+)$/, async function (difficulty) {
    this.logger.log(`The replication difficulty is ${difficulty}`);
    expect(
        this.state.localBlockchain && this.state.localBlockchain.isInitialized,
        'localBlockchain not initialized',
    ).to.be.equal(true);

    let currentDifficulty =
        await this.state.localBlockchain.contracts.HoldingStorage.instance.methods
            .difficultyOverride().call();

    if (currentDifficulty !== difficulty.toString()) {
        this.logger.log(`Changing difficulty modifier to ${difficulty}.`);
        await this.state.localBlockchain.contracts.HoldingStorage.instance.methods
            .setDifficultyOverride(difficulty).send({
                // TODO: Add access to original wallet.
                from: (await this.state.localBlockchain.web3.eth.getAccounts())[7],
                gas: 3000000,
            }).on('error', (error) => { throw error; });

        currentDifficulty = await
        this.state.localBlockchain.contracts.HoldingStorage.instance.methods
            .difficultyOverride().call();

        expect(currentDifficulty).to.be.equal(difficulty.toString());
    }
});

Given(/^the (\d+)[st|nd|rd|th]+ node's spend all the (Ethers|Tokens)$/, async function (nodeIndex, currencyType) {
    expect(this.state.nodes.length, 'No started nodes.').to.be.greaterThan(0);
    expect(this.state.bootstraps.length, 'No bootstrap nodes.').to.be.greaterThan(0);
    expect(nodeIndex, 'Invalid index.').to.be.within(0, this.state.nodes.length);
    expect(currencyType).to.be.oneOf(['Ethers', 'Tokens']);

    const node = this.state.nodes[nodeIndex - 1];
    const { web3 } = this.state.localBlockchain;

    const targetWallet = this.state.localBlockchain.web3.eth.accounts.create();
    const nodeWallet = node.options.nodeConfiguration.node_wallet;

    if (currencyType === 'Ethers') {
        const balance = await this.state.localBlockchain.getBalanceInEthers(nodeWallet);
        const balanceBN = new BN(balance, 10);
        const toSend = balanceBN.sub(new BN(await web3.eth.getGasPrice(), 10).mul(new BN(21000)));
        await web3.eth.sendTransaction({
            to: targetWallet.address,
            from: nodeWallet,
            value: toSend,
            gas: 21000,
            gasPrice: await web3.eth.getGasPrice(),
        });
        expect(await this.state.localBlockchain.getBalanceInEthers(nodeWallet)).to.equal('0');
    } else if (currencyType === 'Tokens') {
        const balance =
            await this.state.localBlockchain.contracts.Token.instance.methods
                .balanceOf(nodeWallet).call();

        await this.state.localBlockchain.contracts.Token.instance.methods
            .transfer(targetWallet.address, balance)
            .send({ from: nodeWallet, gas: 3000000 });
        expect(await this.state.localBlockchain.contracts.Token.instance.methods
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
