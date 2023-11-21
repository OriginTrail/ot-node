import { Given } from '@cucumber/cucumber';
import { expect } from 'chai';
import fs from 'fs';
import LocalBlockchain from './lib/local-blockchain.mjs';

Given(/^the blockchains are set up$/, { timeout: 240_000 }, function blockchainSetup(done) {

    const blockchains = [
        {name: 'test1', port: 8545},
        {name: 'test2', port: 9545}
    ]

    const promises = [];

    blockchains.forEach((blockchain)=>{
        this.logger.log(`Starting local blockchain ${blockchain.name} on port: ${blockchain.port}`);
        const blockchainConsole = new console.Console(
            fs.createWriteStream(`${this.state.scenarionLogDir}/blockchain-${blockchain.name}.log`),
        );
        const localBlockchain = new LocalBlockchain();
        this.state.localBlockchains[blockchain.name] = localBlockchain;

        promises.push(localBlockchain.initialize(blockchain.port, blockchainConsole));
    })

    Promise.all(promises).then(()=>{
        done();
    }).catch((error) => done(error));

});
