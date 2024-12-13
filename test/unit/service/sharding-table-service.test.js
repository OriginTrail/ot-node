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
        const firstAssertionMerkleRoot =
            '0xb44062de45333119471934bc0340c05ff09c0b463392384bc2030cd0a20c334b';
        const hashFunctionId = 1;
        const bidSuggestions = await shardingTableService.getBidSuggestion(
            'ganache',
            epochsNumber,
            assertionSize,
            contentAssetStorageAddress,
            firstAssertionMerkleRoot,
            hashFunctionId,
        );
        expect(bidSuggestions).to.be.equal('3788323225298705400');
    });

    it('Get bid suggestion, returns valid value for assertion size 1b and ask 1 wei', async () => {
        const epochsNumber = 5;
        const contentAssetStorageAddress = '0xABd59A9aa71847F499d624c492d3903dA953d67a';
        const firstAssertionMerkleRoot =
            '0xb44062de45333119471934bc0340c05ff09c0b463392384bc2030cd0a20c334b';
        const hashFunctionId = 1;
        const askInWei = '0.000000000000000001';
        const peers = shardingTableService.repositoryModuleManager.getAllPeerRecords();
        shardingTableService.repositoryModuleManager.getAllPeerRecords = () => {
            peers.forEach((peer) => {
                // eslint-disable-next-line no-param-reassign
                peer.ask = askInWei;
            });
            return peers;
        };
        const bidSuggestion1B = await shardingTableService.getBidSuggestion(
            'ganache',
            epochsNumber,
            1,
            contentAssetStorageAddress,
            firstAssertionMerkleRoot,
            hashFunctionId,
        );
        expect(bidSuggestion1B).to.be.equal('15');
        const bidSuggestion10B = await shardingTableService.getBidSuggestion(
            'ganache',
            epochsNumber,
            10,
            contentAssetStorageAddress,
            firstAssertionMerkleRoot,
            hashFunctionId,
        );
        expect(bidSuggestion10B).to.be.equal('15');
        const bidSuggestion1024B = await shardingTableService.getBidSuggestion(
            'ganache',
            epochsNumber,
            1024,
            contentAssetStorageAddress,
            firstAssertionMerkleRoot,
            hashFunctionId,
        );
        expect(bidSuggestion1024B).to.be.equal('15');
        const bidSuggestion2048B = await shardingTableService.getBidSuggestion(
            'ganache',
            epochsNumber,
            2048,
            contentAssetStorageAddress,
            firstAssertionMerkleRoot,
            hashFunctionId,
        );
        expect(bidSuggestion2048B).to.be.equal('30');
    });
});
