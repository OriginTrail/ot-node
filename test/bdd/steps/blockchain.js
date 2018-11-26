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
    expect(
        this.state.localBlockchain && this.state.localBlockchain.isInitialized,
        'localBlockchain not initialized',
    ).to.be.equal(true);

    let currentDifficulty =
        await this.state.localBlockchain.holdingInstance.methods.difficultyOverride().call();

    if (currentDifficulty !== difficulty.toString()) {
        this.logger.log(`Changing difficulty modifier to ${difficulty}.`);
        await this.state.localBlockchain.holdingInstance.methods
            .setDifficulty(difficulty).send({
                // TODO: Add access to original wallet.
                from: (await this.state.localBlockchain.web3.eth.getAccounts())[7],
                gas: 3000000,
            }).on('error', (error) => { throw error; });

        currentDifficulty =
            await this.state.localBlockchain.holdingInstance.methods.difficultyOverride().call();
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

    console.log('target', JSON.stringify(targetWallet));

    if (currencyType === 'Ethers') {
        const balance = await this.state.localBlockchain.getBalanceInEthers(nodeWallet);
        const balanceBN = new BN(balance, 10);
        const toSend = balanceBN.sub(new BN(await web3.eth.getGasPrice(), 10).mul(new BN(21000)));
        console.log('ethersWei', balance);
        console.log('ethersWeiToSend', toSend.toString());
        console.log('gasss', await web3.eth.getGasPrice());
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
            await this.state.localBlockchain.tokenInstance.methods.balanceOf(nodeWallet).call();
        console.log('tokens', balance);

        await this.state.localBlockchain.tokenInstance.methods
            .transfer(targetWallet.address, balance)
            .send({ from: nodeWallet, gas: 3000000 });
        expect(await this.state.localBlockchain.tokenInstance.methods.balanceOf(nodeWallet).call()).to.equal('0');
    }
});
