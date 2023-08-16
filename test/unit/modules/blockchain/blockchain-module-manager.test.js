import { describe, it, beforeEach } from 'mocha';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';
import BlockchainModuleManager from '../../../../src/modules/blockchain/blockchain-module-manager.js';
import Logger from '../../../../src/logger/logger.js';

let blockchainManager;

const config = JSON.parse(await readFile('./test/unit/modules/blockchain/config.json', 'utf-8'));

describe.only('Blockchain module manager', async () => {
    beforeEach('initialize blockchain manager', async () => {
        blockchainManager = new BlockchainModuleManager({
            config,
            logger: new Logger(),
        });
    });

    it('validate module name is as expected', async () => {
        const moduleName = blockchainManager.getName();
        expect(moduleName).to.equal('blockchain');
    });

    it('validate module name is as expected', async () => {
        const moduleName = blockchainManager.getTransactionQueueLength();
        console.log(moduleName);
    });
});
