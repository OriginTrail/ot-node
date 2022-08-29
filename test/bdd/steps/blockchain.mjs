import { Given } from '@cucumber/cucumber';
import { expect } from 'chai';
import LocalBlockchain from './lib/local-blockchain.mjs';

Given(/^the blockchain is set up$/, { timeout: 60000 }, function blockchinSetup(done) {
    expect(this.state.localBlockchain, "localBlockchain shouldn't be defined").to.be.equal(null);

    this.state.localBlockchain = new LocalBlockchain({ logger: this.logger });
    this.state.localBlockchain
        .initialize()
        .then(() => {
            done();
        })
        .catch((error) => done(error));
});
