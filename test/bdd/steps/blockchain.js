/* eslint-disable prefer-arrow-callback */

const {
    And, But, Given, Then, When,
} = require('cucumber');
const { expect } = require('chai');

const LocalBlockchain = require('./lib/local-blockchain');

Given(/^the blockchain is set up$/, { timeout: 60000 }, function (done) {
    expect(this.state.localBlockchain, 'localBlockchain shouldn\'t be defined').to.be.equal(null);

    this.state.localBlockchain = new LocalBlockchain({ logger: this.logger });
    this.state.localBlockchain.initialize().then(() => {
        done();
    }).catch(error => done(error));
});

Given(/^the replication factor is (\d+)$/, async function (replicationFactor) {
    expect(
        this.state.localBlockchain && this.state.localBlockchain.isInitialized,
        'localBlockchain not initialized',
    ).to.be.equal(true);

    const currentModifier =
        await this.state.localBlockchain.biddingInstance.methods.replication_modifier().call();

    if (currentModifier !== replicationFactor) {
        this.logger.log(`Changing replication modifier to ${replicationFactor}.`);
        await this.state.localBlockchain.biddingInstance.methods.replication_modifier().send({
            // TODO: Add access to original wallet.
            from: (await this.state.localBlockchain.web3.eth.getAccounts())[7],
            gas: 3000000,
        }).on('error', (error) => { throw error; });
    }
});
