import { ethers } from 'ethers';
import { BigNumber } from 'bignumber.js';
import { xor as uint8ArrayXor } from 'uint8arrays/xor';
import { compare as uint8ArrayCompare } from 'uint8arrays/compare';
import pipe from 'it-pipe';
import map from 'it-map';
import sort from 'it-sort';
import take from 'it-take';
import all from 'it-all';

import {
    CONTRACTS,
    DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS,
} from '../constants/constants.js';

class ShardingTableService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.eventEmitter = ctx.eventEmitter;
    }

    async initialize(blockchainId) {
        await this.pullBlockchainShardingTable(blockchainId);
        await this.listenOnEvents(blockchainId);
        const that = this;
        await this.networkModuleManager.onPeerConnected((connection) => {
            this.logger.trace(
                `Node connected to ${connection.remotePeer.toB58String()}, updating sharding table last seen and last dialed.`,
            );
            that.repositoryModuleManager
                .updatePeerRecordLastSeenAndLastDialed(connection.remotePeer.toB58String())
                .catch((error) => {
                    this.logger.warn(`Unable to update connected peer, error: ${error.message}`);
                });
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

        const shardingTableLength = Number(
            await this.blockchainModuleManager.getShardingTableLength(blockchainId),
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
        // TODO: mark starting block and listen to events from that block
        while (shardingTable.length < shardingTableLength) {
            // eslint-disable-next-line no-await-in-loop
            const nodes = await this.blockchainModuleManager.getShardingTablePage(
                blockchainId,
                startingIdentityId,
                pageSize,
            );
            shardingTable.push(...nodes.slice(sliceIndex).filter((node) => node.id !== '0x'));
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
                        peer.id,
                    );

                    return {
                        peer_id: nodeId,
                        blockchain_id: blockchainId,
                        ask: ethers.utils.formatUnits(peer.ask, 'ether'),
                        stake: ethers.utils.formatUnits(peer.stake, 'ether'),
                        sha256: await this.validationModuleManager.callHashFunction(1, nodeId),
                    };
                }),
            ),
        );
    }

    async listenOnEvents(blockchainId) {
        this.eventEmitter.on(`${blockchainId}-NodeAdded`, async (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );

            const nodeIdSha256 = await this.validationModuleManager.callHashFunction(
                // TODO: How to add more hashes?
                1,
                nodeId,
            );

            this.logger.trace(
                `${blockchainId}-NodeAdded event caught, adding peer id: ${nodeId} to sharding table.`,
            );

            this.repositoryModuleManager.createPeerRecord(
                nodeId,
                event.blockchain_id,
                ethers.utils.formatUnits(eventData.ask, 'ether'),
                ethers.utils.formatUnits(eventData.stake, 'ether'),
                new Date(0),
                nodeIdSha256,
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-NodeRemoved`, (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${blockchainId}-NodeRemoved event caught, removing peer id: ${nodeId} from sharding table.`,
            );
            this.repositoryModuleManager.removePeerRecord(blockchainId, nodeId);

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-StakeUpdated`, (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${blockchainId}-StakeUpdated event caught, updating stake value for peer id: ${nodeId} in sharding table.`,
            );
            this.repositoryModuleManager.updatePeerStake(nodeId, eventData.stake);
            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
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

        const sorted = pipe(
            peers,
            (source) =>
                map(source, async (peer) => ({
                    peer,
                    distance: this.calculateDistance(keyHash, peer[hashFunctionName]),
                })),
            (source) => sort(source, (a, b) => uint8ArrayCompare(a.distance, b.distance)),
            (source) => take(source, count),
            (source) => map(source, (pd) => pd.peer),
        );

        return all(sorted);
    }

    calculateDistance(peerHash, keyHash) {
        return uint8ArrayXor(ethers.utils.arrayify(peerHash), ethers.utils.arrayify(keyHash));
    }

    async getBidSuggestion(blockchainId, epochsNumber, assertionSize) {
        const peers = await this.repositoryModuleManager.getAllPeerRecords(blockchainId, true);

        let sum = 0;
        for (const node of peers) {
            sum += node.ask;
        }

        const r0 = await this.blockchainModuleManager.getR0(blockchainId);

        return new BigNumber(assertionSize)
            .dividedBy(peers.length)
            .dividedBy(1024)
            .multipliedBy(sum)
            .multipliedBy(epochsNumber)
            .multipliedBy(r0)
            .toString();
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
                await this.repositoryModuleManager.updatePeerRecordLastSeenAndLastDialed(peerId);
            } catch (error) {
                this.logger.trace(`Unable to dial peer ${peerId}. Error: ${error.message}`);
                await this.repositoryModuleManager.updatePeerRecordLastDialed(peerId);
            }
        } else {
            await this.repositoryModuleManager.updatePeerRecordLastDialed(peerId);
        }
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
