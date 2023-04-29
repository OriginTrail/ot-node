// eslint-disable-next-line import/no-unresolved
import { xor as uint8ArrayXor, compare as uint8ArrayCompare } from 'uint8arrays';

import {
    BYTES_IN_KILOBYTE,
    CONTRACTS,
    DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS,
    PEER_RECORD_UPDATE_DELAY,
} from '../constants/constants.js';

class ShardingTableService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;

        this.memoryCachedPeerIds = {};
    }

    async initialize() {
        const pullBlockchainShardingTables = this.blockchainModuleManager
            .getImplementationNames()
            .map((blockchainId) => this.pullBlockchainShardingTable(blockchainId));
        await Promise.all(pullBlockchainShardingTables);

        await this.networkModuleManager.onPeerConnected((event) => {
            this.logger.trace(
                `Node connected to ${event.detail.remotePeer.toString()}, updating sharding table last seen and last dialed.`,
            );
            this.updatePeerRecordLastSeenAndLastDialed(event.detail.remotePeer.toString()).catch(
                (error) => {
                    this.logger.warn(`Unable to update connected peer, error: ${error.message}`);
                },
            );
        });
    }

    async pullBlockchainShardingTable(blockchainId) {
        const lastCheckedBlock = await this.repositoryModuleManager.getLastCheckedBlock(
            blockchainId,
            CONTRACTS.SHARDING_TABLE_CONTRACT,
        );

        if (
            lastCheckedBlock?.last_checked_timestamp &&
            Date.now() - lastCheckedBlock.last_checked_timestamp <
                DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS
        ) {
            return;
        }

        this.logger.debug(
            `Removing nodes from local sharding table for blockchain ${blockchainId}.`,
        );
        await this.repositoryModuleManager.removeShardingTablePeerRecords(blockchainId);

        const shardingTableLength = await this.blockchainModuleManager.getShardingTableLength(
            blockchainId,
        );
        let startingIdentityId = await this.blockchainModuleManager.getShardingTableHead(
            blockchainId,
        );
        const pageSize = 10;
        const shardingTable = [];

        this.logger.debug(
            `Started pulling ${shardingTableLength} nodes from blockchain sharding table.`,
        );

        let sliceIndex = 0;
        while (shardingTable.length < shardingTableLength) {
            // eslint-disable-next-line no-await-in-loop
            const nodes = await this.blockchainModuleManager.getShardingTablePage(
                blockchainId,
                startingIdentityId,
                pageSize,
            );
            shardingTable.push(...nodes.slice(sliceIndex).filter((node) => node.nodeId !== '0x'));
            sliceIndex = 1;
            startingIdentityId = nodes[nodes.length - 1].identityId;
        }

        this.logger.debug(
            `Finished pulling ${shardingTable.length} nodes from blockchain sharding table.`,
        );

        await this.repositoryModuleManager.createManyPeerRecords(
            await Promise.all(
                shardingTable.map(async (peer) => {
                    const nodeId = this.blockchainModuleManager.convertHexToAscii(
                        blockchainId,
                        peer.nodeId,
                    );

                    return {
                        peer_id: nodeId,
                        blockchain_id: blockchainId,
                        ask: this.blockchainModuleManager.convertFromWei(
                            blockchainId,
                            peer.ask,
                            'ether',
                        ),
                        stake: this.blockchainModuleManager.convertFromWei(
                            blockchainId,
                            peer.stake,
                            'ether',
                        ),
                        sha256: await this.validationModuleManager.callHashFunction(1, nodeId),
                    };
                }),
            ),
        );
    }

    async findNeighbourhood(blockchainId, key, r2, hashFunctionId, filterLastSeen) {
        const peers = await this.repositoryModuleManager.getAllPeerRecords(
            blockchainId,
            filterLastSeen,
        );
        const keyHash = await this.validationModuleManager.callHashFunction(hashFunctionId, key);

        return this.sortPeers(blockchainId, keyHash, peers, r2, hashFunctionId);
    }

    async sortPeers(blockchainId, keyHash, peers, count, hashFunctionId) {
        const hashFunctionName = this.validationModuleManager.getHashFunctionName(hashFunctionId);

        return peers
            .map((peer) => ({
                peer,
                distance: this.calculateDistance(blockchainId, keyHash, peer[hashFunctionName]),
            }))
            .sort((a, b) => uint8ArrayCompare(a.distance, b.distance))
            .slice(0, count)
            .map((pd) => pd.peer);
    }

    calculateDistance(blockchain, peerHash, keyHash) {
        return uint8ArrayXor(
            this.blockchainModuleManager.convertBytesToUint8Array(blockchain, peerHash),
            this.blockchainModuleManager.convertBytesToUint8Array(blockchain, keyHash),
        );
    }

    async getBidSuggestion(
        blockchainId,
        epochsNumber,
        assertionSize,
        contentAssetStorageAddress,
        firstAssertionId,
        hashFunctionId,
    ) {
        const kbSize = assertionSize < BYTES_IN_KILOBYTE ? BYTES_IN_KILOBYTE : assertionSize;
        const peerRecords = await this.findNeighbourhood(
            blockchainId,
            this.blockchainModuleManager.encodePacked(
                blockchainId,
                ['address', 'bytes32'],
                [contentAssetStorageAddress, firstAssertionId],
            ),
            await this.blockchainModuleManager.getR2(blockchainId),
            hashFunctionId,
            true,
        );

        const sorted = peerRecords.sort((a, b) => a.ask - b.ask);

        const { ask } = sorted[Math.floor(sorted.length * 0.75)];

        const r0 = await this.blockchainModuleManager.getR0(blockchainId);

        return this.blockchainModuleManager
            .toBigNumber(blockchainId, this.blockchainModuleManager.convertToWei(blockchainId, ask))
            .mul(kbSize)
            .mul(epochsNumber)
            .mul(r0)
            .div(BYTES_IN_KILOBYTE)
            .toString();
    }

    async findEligibleNodes(neighbourhood, bid, r1, r0) {
        return neighbourhood.filter((node) => node.ask <= bid / r0).slice(0, r1);
    }

    async dial(peerId) {
        const { addresses } = await this.findPeerAddressAndProtocols(peerId);
        if (addresses.length) {
            try {
                if (peerId !== this.networkModuleManager.getPeerIdString()) {
                    this.logger.trace(`Dialing peer ${peerId}.`);
                    await this.networkModuleManager.dial(peerId);
                }
                await this.updatePeerRecordLastSeenAndLastDialed(peerId);
            } catch (error) {
                this.logger.trace(`Unable to dial peer ${peerId}. Error: ${error.message}`);
                await this.updatePeerRecordLastDialed(peerId);
            }
        } else {
            await this.updatePeerRecordLastDialed(peerId);
        }
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId) {
        const now = Date.now();
        const timestampThreshold = now - PEER_RECORD_UPDATE_DELAY;

        if (!this.memoryCachedPeerIds[peerId]) {
            this.memoryCachedPeerIds[peerId] = {
                lastUpdated: 0,
                lastDialed: 0,
                lastSeen: 0,
            };
        }
        if (this.memoryCachedPeerIds[peerId].lastUpdated < timestampThreshold) {
            await this.repositoryModuleManager.updatePeerRecordLastSeenAndLastDialed(peerId, now);
            this.memoryCachedPeerIds[peerId].lastUpdated = now;
        }
        this.memoryCachedPeerIds[peerId].lastDialed = now;
        this.memoryCachedPeerIds[peerId].lastSeen = now;
    }

    async updatePeerRecordLastDialed(peerId) {
        const now = Date.now();
        const timestampThreshold = now - PEER_RECORD_UPDATE_DELAY;
        if (!this.memoryCachedPeerIds[peerId]) {
            this.memoryCachedPeerIds[peerId] = {
                lastUpdated: 0,
                lastDialed: 0,
                lastSeen: 0,
            };
        }
        if (this.memoryCachedPeerIds[peerId].lastUpdated < timestampThreshold) {
            await this.repositoryModuleManager.updatePeerRecordLastDialed(peerId, now);
            this.memoryCachedPeerIds[peerId].lastUpdated = now;
        }
        this.memoryCachedPeerIds[peerId].lastDialed = now;
    }

    async findPeerAddressAndProtocols(peerId) {
        this.logger.trace(`Searching for peer ${peerId} multiaddresses in peer store.`);
        let peerInfo;
        try {
            peerInfo = await this.networkModuleManager.getPeerInfo(peerId);
        } catch (error) {
            /* empty */
        }
        if (
            !peerInfo?.addresses?.length &&
            peerId !== this.networkModuleManager.getPeerIdString()
        ) {
            try {
                this.logger.trace(`Searching for peer ${peerId} multiaddresses on the network.`);
                peerInfo = await this.networkModuleManager.findPeer(peerId);
            } catch (error) {
                this.logger.trace(`Unable to find peer ${peerId}. Error: ${error.message}`);
            }
        }

        return {
            id: peerId,
            addresses: peerInfo?.addresses ?? [],
            protocols: peerInfo?.protocols ?? [],
        };
    }
}

export default ShardingTableService;
