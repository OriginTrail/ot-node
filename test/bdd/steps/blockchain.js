const {
    And, But, Given, Then, When,
} = require('@cucumber/cucumber');
const { expect } = require('chai');
const LocalBlockchain = require('./lib/local-blockchain');

Given(/^the blockchain is set up$/, { timeout: 120000 }, function (done) {
    expect(this.state.localBlockchain, 'localBlockchain shouldn\'t be defined').to.be.equal(null);

    this.state.localBlockchain = new LocalBlockchain({ logger: this.logger });
    this.state.localBlockchain.initialize().then(() => {
        done();
    }).catch((error) => done(error));
});
