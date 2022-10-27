class ShardingTableService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.eventEmitter = ctx.eventEmitter;
    }

    async initialize(blockchainId) {
        await this.pullBlockchainShardingTable(blockchainId);
        await this.listenOnEvents(blockchainId);
        const that = this;
        await this.networkModuleManager.onPeerConnected((connection) => {
            this.logger.debug(
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
        const shardingTable = await this.blockchainModuleManager.getShardingTableFull(blockchainId);

        await this.repositoryModuleManager.createManyPeerRecords(
            shardingTable.map((peer) => ({
                peer_id: this.blockchainModuleManager.convertHexToAscii(
                    blockchainId,
                    peer.id.slice(2),
                ),
                blockchain_id: blockchainId,
                ask: peer.ask,
                stake: peer.stake,
                sha256: peer.id_sha256,
            })),
        );
    }

    listenOnEvents(blockchainId) {
        this.eventEmitter.on(`${blockchainId}-NodeObjCreated`, (event) => {
            const eventData = JSON.parse(event.data);
            this.logger.debug(
                `${blockchainId}-NodeObjCreated event caught, adding peer id: ${eventData.nodeId} to sharding table.`,
            );

            this.repositoryModuleManager.createPeerRecord(
                this.blockchainModuleManager.convertHexToAscii(
                    event.blockchain_id,
                    eventData.nodeId.slice(2),
                ),
                event.blockchain_id,
                eventData.ask,
                eventData.stake,
                new Date(0),
                eventData.id_sha256,
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-StakeUpdated`, (event) => {
            const eventData = JSON.parse(event.data);
            this.logger.debug(
                `${blockchainId}-StakeUpdated event caught, updating stake value for peer id: ${eventData.nodeId} in sharding table.`,
            );
            this.repositoryModuleManager.updatePeerStake(eventData.nodeId, eventData.stake);

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-NodeRemoved`, (event) => {
            const eventData = JSON.parse(event.data);
            this.logger.debug(
                `${blockchainId}-NodeRemoved event caught, removing peer id: ${eventData.nodeId} from sharding table.`,
            );
            this.repositoryModuleManager.removePeerRecord(eventData.nodeId);

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
    }

    async findNeighbourhood(key, blockchainId, r2) {
        const peers = await this.repositoryModuleManager.getAllPeerRecords(blockchainId);

        return this.networkModuleManager.sortPeers(key, peers, r2);
    }

    async getBidSuggestion(neighbourhood, r0, higherPercentile) {
        const neighbourhoodSortedByAsk = neighbourhood.sort(
            (node_one, node_two) => node_one.ask < node_two.ask,
        );

        const eligibleNodes = neighbourhoodSortedByAsk.slice(
            0,
            Math.ceil((higherPercentile / 100) * neighbourhood.length),
        );

        const eligibleNodesSortedByStake = eligibleNodes.sort(
            (node_one, node_two) => node_one.stake > node_two.stake,
        );

        const awardedNodes = eligibleNodesSortedByStake.slice(0, r0);

        return Math.max(...awardedNodes.map((node) => node.ask)) * r0;
    }

    async findEligibleNodes(neighbourhood, bid, r1, r0) {
        return neighbourhood.filter((node) => node.ask <= bid / r0).slice(0, r1);
    }

    async dial(peerId) {
        const peerInfo = await this.findPeerAddressAndProtocols(peerId);
        if (peerInfo.addresses.length) {
            this.logger.trace(`Dialing peer ${peerId}.`);
            try {
                await this.networkModuleManager.dial(peerId);
            } catch (error) {
                this.logger.warn(`Unable to dial peer ${peerId}. Error: ${error.message}`);
            }
            await this.repositoryModuleManager.updatePeerRecordLastSeenAndLastDialed(peerId);
        } else {
            await this.repositoryModuleManager.updatePeerRecordLastDialed(peerId);
        }
    }

    async findPeerAddressAndProtocols(peerId) {
        this.logger.trace(`Searching for peer ${peerId} multiaddresses in peer store.`);
        const { addresses, protocols } = this.networkModuleManager.getPeerInfo(peerId);
        if (!addresses.length && !protocols?.length) {
            try {
                this.logger.trace(`Searching for peer ${peerId} multiaddresses on the network.`);
                const peerFound = await this.networkModuleManager.findPeer(peerId);
                return {
                    id: peerId,
                    addresses: peerFound.multiaddrs,
                    protocols: peerFound.protocols,
                };
            } catch (error) {
                this.logger.warn(`Unable to find peer ${peerId}. Error: ${error.message}`);
            }
        }
        return { id: peerId, addresses, protocols };
    }
}

export default ShardingTableService;
