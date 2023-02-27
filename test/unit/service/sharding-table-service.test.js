import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import ShardingTableService from '../../../src/service/sharding-table-service.js';
import BlockchainModuleManagerMock from '../mock/blockchain-module-manager-mock.js';
import RepositoryModuleManagerMock from '../mock/repository-module-manager-mock.js';
import NetworkModuleManagerMock from '../mock/network-module-manager-mock.js';
import ValidationModuleManagerMock from '../mock/validation-module-manager-mock.js';
import EventEmitterMock from '../mock/event-emitter-mock.js';
import { BYTES_IN_KILOBYTE } from '../../../src/constants/constants.js';

let shardingTableService;

describe('Sharding table service test', async () => {
    beforeEach(() => {
        shardingTableService = new ShardingTableService({
            blockchainModuleManager: new BlockchainModuleManagerMock(),
            repositoryModuleManager: new RepositoryModuleManagerMock(),
            networkModuleManager: new NetworkModuleManagerMock(),
            validationModuleManager: new ValidationModuleManagerMock(),
            eventEmitter: new EventEmitterMock(),
        });
    });

    it('Get bid suggestion, returns bid suggestion successfully', async () => {
        const epochsNumber = 5;
        const assertionSize = BYTES_IN_KILOBYTE;
        const contentAssetStorageAddress = '0xABd59A9aa71847F499d624c492d3903dA953d67a';
        const firstAssertionId =
            '0xb44062de45333119471934bc0340c05ff09c0b463392384bc2030cd0a20c334b';
        const hashFunctionId = 1;
        const bidSuggestions = await shardingTableService.getBidSuggestion(
            'ganache',
            epochsNumber,
            assertionSize,
            contentAssetStorageAddress,
            firstAssertionId,
            hashFunctionId,
        );
        expect(bidSuggestions).to.be.equal('3788323225298705400');
    });
});
