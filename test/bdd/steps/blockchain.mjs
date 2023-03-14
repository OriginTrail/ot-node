import { Given } from '@cucumber/cucumber';
import { expect } from 'chai';
import LocalBlockchain from './lib/local-blockchain.mjs';
import fs from 'fs';

Given(/^the blockchain is set up$/, { timeout: 60000 }, function blockchainSetup(done) {
    expect(this.state.localBlockchain, "localBlockchain shouldn't be defined").to.be.equal(null);
    const blockchainConsole = new console.Console(fs.createWriteStream(`${this.state.scenarionLogDir}/blockchain.log`));

    this.state.localBlockchain = new LocalBlockchain();
    this.state.localBlockchain
        .initialize(blockchainConsole)
        .then(() => {
            done();
        })
        .catch((error) => done(error));
});
