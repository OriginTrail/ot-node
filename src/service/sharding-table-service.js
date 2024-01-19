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
        this.hashingService = ctx.hashingService;
        this.proximityScoringService = ctx.proximityScoringService;

        this.memoryCachedPeerIds = {};
    }

    async initialize() {
        const pullBlockchainShardingTables = this.blockchainModuleManager
            .getImplementationNames()
            .map((blockchainId) => this.pullBlockchainShardingTable(blockchainId));
        await Promise.all(pullBlockchainShardingTables);

        await this.networkModuleManager.onPeerConnected((connection) => {
            this.logger.trace(
                `Node connected to ${connection.remotePeer.toB58String()}, updating sharding table last seen and last dialed.`,
            );
            this.updatePeerRecordLastSeenAndLastDialed(connection.remotePeer.toB58String()).catch(
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
            lastCheckedBlock?.lastCheckedTimestamp &&
            Date.now() - lastCheckedBlock.lastCheckedTimestamp <
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
                        peerId: nodeId,
                        blockchainId,
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
                        sha256: await this.hashingService.callHashFunction(1, nodeId),
                    };
                }),
            ),
        );
    }

    async findNeighbourhood(
        blockchainId,
        key,
        r2,
        hashFunctionId,
        proximityScoreFunctionsPairId,
        filterLastSeen,
    ) {
        const peers = await this.repositoryModuleManager.getAllPeerRecords(
            blockchainId,
            filterLastSeen,
        );
        const keyHash = await this.hashingService.callHashFunction(hashFunctionId, key);

        const soretedPeers = this.sortPeers(
            blockchainId,
            keyHash,
            peers,
            r2,
            hashFunctionId,
            proximityScoreFunctionsPairId,
        );
        return soretedPeers;
    }

    async sortPeers(
        blockchainId,
        keyHash,
        peers,
        count,
        hashFunctionId,
        proximityScoreFunctionsPairId,
    ) {
        const hashFunctionName = this.hashingService.getHashFunctionName(hashFunctionId);
        const peersWithDistance = await Promise.all(
            peers.map(async (peer) => ({
                peer,
                distance: await this.proximityScoringService.callProximityFunction(
                    blockchainId,
                    proximityScoreFunctionsPairId,
                    peer[hashFunctionName],
                    keyHash,
                ),
            })),
        );
        peersWithDistance.sort((a, b) => {
            if (a.distance < b.distance) {
                return -1;
            }
            if (a.distance > b.distance) {
                return 1;
            }
            return 0;
        });
        const result = peersWithDistance.slice(0, count).map((pd) => pd.peer);
        return result;
    }

    async getBidSuggestion(
        blockchainId,
        epochsNumber,
        assertionSize,
        contentAssetStorageAddress,
        firstAssertionId,
        hashFunctionId,
        proximityScoreFunctionsPairId,
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
            proximityScoreFunctionsPairId,
            true,
        );
        const r1 = await this.blockchainModuleManager.getR1(blockchainId);
        // todo remove this line once we implement logic for storing assertion in publish node if it's in neighbourhood
        const myPeerId = this.networkModuleManager.getPeerId().toB58String();
        const filteredPeerRecords = peerRecords.filter((peer) => peer.peerId !== myPeerId);
        const sorted = filteredPeerRecords.sort((a, b) => a.ask - b.ask);
        let ask;
        if (sorted.length > r1) {
            ask = sorted[r1 - 1].ask;
        } else {
            ask = sorted[sorted.length - 1].ask;
        }

        const r0 = await this.blockchainModuleManager.getR0(blockchainId);

        const bidSuggestion = this.blockchainModuleManager
            .toBigNumber(blockchainId, this.blockchainModuleManager.convertToWei(blockchainId, ask))
            .mul(kbSize)
            .mul(epochsNumber)
            .mul(r0)
            .div(BYTES_IN_KILOBYTE);
        return bidSuggestion.toString();
    }

    async findEligibleNodes(neighbourhood, bid, r1, r0) {
        return neighbourhood.filter((node) => node.ask <= bid / r0).slice(0, r1);
    }

    async dial(peerId) {
        const { addresses } = await this.findPeerAddressAndProtocols(peerId);
        if (addresses.length) {
            try {
                if (peerId !== this.networkModuleManager.getPeerId().toB58String()) {
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
            const [rowsUpdated] =
                await this.repositoryModuleManager.updatePeerRecordLastSeenAndLastDialed(
                    peerId,
                    now,
                );
            if (rowsUpdated) {
                this.memoryCachedPeerIds[peerId].lastUpdated = now;
            }
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
            const [rowsUpdated] = await this.repositoryModuleManager.updatePeerRecordLastDialed(
                peerId,
                now,
            );
            if (rowsUpdated) {
                this.memoryCachedPeerIds[peerId].lastUpdated = now;
            }
        }
        this.memoryCachedPeerIds[peerId].lastDialed = now;
    }

    async findPeerAddressAndProtocols(peerId) {
        this.logger.trace(`Searching for peer ${peerId} multiaddresses in peer store.`);
        let peerInfo = await this.networkModuleManager.getPeerInfo(peerId);
        if (
            !peerInfo?.addresses?.length &&
            peerId !== this.networkModuleManager.getPeerId().toB58String()
        ) {
            try {
                this.logger.trace(`Searching for peer ${peerId} multiaddresses on the network.`);
                await this.networkModuleManager.findPeer(peerId);
                peerInfo = await this.networkModuleManager.getPeerInfo(peerId);
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
