import { Given } from '@cucumber/cucumber';
import { expect } from 'chai';
import fs from 'fs';
import LocalBlockchain from './lib/local-blockchain.mjs';

Given(/^the blockchain is set up$/, { timeout: 240_000 }, function blockchainSetup(done) {
    this.logger.log('Starting blockchain');
    expect(this.state.localBlockchain, "localBlockchain shouldn't be defined").to.be.equal(null);
    const blockchainConsole = new console.Console(
        fs.createWriteStream(`${this.state.scenarionLogDir}/blockchain.log`),
    );

    this.state.localBlockchain = new LocalBlockchain();
    this.state.localBlockchain
        .initialize(blockchainConsole)
        .then(() => {
            done();
        })
        .catch((error) => done(error));
});

Given(/^the blockchain is set up on port (\d+) and on port (\d+)$/, { timeout: 240_000 }, function blockchainSetup(port1, port2, done) {
    this.logger.log(`Starting local blockchain on port: ${port1} and port: ${port2}`);

    const blockchainConsole1 = new console.Console(
        fs.createWriteStream(`${this.state.scenarionLogDir}/blockchain${port1}.log`),
    );
    const blockchainConsole2 = new console.Console(
        fs.createWriteStream(`${this.state.scenarionLogDir}/blockchain${port2}.log`),
    );
    const promises = [];

    const localBlockchain1 = new LocalBlockchain();
    this.state.localBlockchains.push(localBlockchain1);

    const localBlockchain2 = new LocalBlockchain();
    this.state.localBlockchains.push(localBlockchain2);

    promises.push(localBlockchain1.initialize(port1, blockchainConsole1));
    promises.push(localBlockchain2.initialize(port2, blockchainConsole2));

    Promise.all(promises).then(()=>{
        done();
    }).catch((error) => done(error));

});
