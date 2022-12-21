import { beforeEach, describe, it } from 'mocha';
import { ethers } from 'ethers';
import { expect } from 'chai';
import ShardingTableService from '../../../src/service/sharding-table-service.js';

const testR2 = 20;
const testR0 = 3;

const testPeers = [
    {
        peer_id: 'QmcJY13uLyt2VQ6QiVNcYiWaxdfaHWHj3T7G472uaHPBf7',
        blockchain_id: 'ganache',
        ask: '0.2824612246520951',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0x6e08776479a010d563855dbc371a66f692d3edcbcf2b02c30f9879ebe02244e8',
    },
    {
        peer_id: 'Qmcxo88zf5zEvyBLYTrtfG8nGJQW6zHpf58b5MUcjoYVqL',
        blockchain_id: 'ganache',
        ask: '0.11680988694381877',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0x113d3da32b0e0b7031d188736792bbea0baf7911acb905511ac7dda2be9a6f55',
    },
    {
        peer_id: 'QmQeNwBzgeMQxquQEDXvBHqXBHNBEvKHtyHURg4QvnoLrD',
        blockchain_id: 'ganache',
        ask: '0.25255488168658036',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0xba14ac66ab5be40bf458bad9b4e9f10a9d06375b233e91a6ce3c2d4cbf9deea5',
    },
    {
        peer_id: 'QmU4ty8X8L4Xk6cbDCoyJUhgeBNLDo3HprTGEhNd9CtiT7',
        blockchain_id: 'ganache',
        ask: '0.25263875217271087',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0x5b3fdb88b3270a99cc89d28e0a4504d28789e5f8ca53080aa7608db48546d56b',
    },
    {
        peer_id: 'QmWmgmMCQQ1awraTeQqwsbWgqtR3ZMuX7NhbHyiftuAspb',
        blockchain_id: 'ganache',
        ask: '0.2429885059428509',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0x820a8e38cb792b89c8b69eb9c192faf3def6175c97c4c0f17708161bcb9c5028',
    },
    {
        peer_id: 'QmWyf3dtqJnhuCpzEDTNmNFYc5tjxTrXhGcUUmGHdg2gtj',
        blockchain_id: 'ganache',
        ask: '0.210617584797714',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0xf764186e9b675f3fd00af72026cf075d05ce8fc951ba089351d645b363acd3d3',
    },
    {
        peer_id: 'QmXgeHgBVbd7iyTp8PapUAyeKciqbsXTEvsakCjW7wZRqT',
        blockchain_id: 'ganache',
        ask: '0.2290449496761527',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0xaaeed7b766483aef7cf2d07325f336b3e703e2b7573e540ca8c6e2aab34265c3',
    },
    {
        peer_id: 'QmYys42KLmGEE9hEmJCVCe3SR3G9zf4epoAwDUK7pVUP6S',
        blockchain_id: 'ganache',
        ask: '0.1637075464317365',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0xc3bb7b5433ebe62ff9e98c6d439223d07d44e16e7d5e210e727823f87c0ef24b',
    },
    {
        peer_id: 'QmZi2nDhZJfa1Z5iXjvxQ1BigpR8TdTQ3gWQDGecn34e9x',
        blockchain_id: 'ganache',
        ask: '0.10242295311162795',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0x510ca60cdd7b33bf8d978576981ae7f9caaf5f133ddd40693d8ce007614c0a09',
    },
    {
        peer_id: 'QmZueq5jip24v5dbCSBGt8v16hPjUN1CXRb3zGaxH1jfHM',
        blockchain_id: 'ganache',
        ask: '0.23374911902136858',
        stake: '50000.0',
        last_seen: '1970-01-01 00:00:00',
        last_dialed: '1970-01-01 00:00:00',
        sha256: '0x7b4f717bd647104a72c7f1fce4600366982f36ebb1cef41540a5541c8e8ca1dd',
    },
];

const blockchainModuleManagerMock = {
    getR2: () => testR2,
    getR0: () => testR0,
    convertToWei: (blockchainId, value) =>
        ethers.utils.parseUnits(value.toString(), 'ether').toString(),
};

const repositoryModuleManagerMock = {
    getAllPeerRecords: () => testPeers,
};

const networkModuleManagerMock = {};

const validationModuleManagerMock = {
    callHashFunction: (data) => {
        const bytesLikeData = ethers.utils.toUtf8Bytes(data);
        return ethers.utils.sha256(bytesLikeData);
    },
    getHashFunctionName: () => 'sha256',
};

const eventEmitterMock = {};
let shardingTableService;

describe('Sharding table service test', async () => {
    beforeEach(() => {
        shardingTableService = new ShardingTableService({
            blockchainModuleManager: blockchainModuleManagerMock,
            repositoryModuleManager: repositoryModuleManagerMock,
            networkModuleManager: networkModuleManagerMock,
            validationModuleManager: validationModuleManagerMock,
            eventEmitter: eventEmitterMock,
        });
    });

    it('Get bid suggestion, returns bid suggestion successfully', async () => {
        const epochsNumber = 5;
        const assertionSize = 1024;
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
