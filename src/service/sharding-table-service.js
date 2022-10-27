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

        const textEncoder = new TextEncoder();
        const thisPeerId = this.networkModuleManager.getPeerId().toB58String();
        const promises = [];
        for (const peer of shardingTable) {
            if (peer.id !== thisPeerId) {
                this.networkModuleManager.toHash(textEncoder.encode(peer.id)).then((sha256) =>
                    promises.push({
                        peer_id: peer.id,
                        blockchain_id: blockchainId,
                        ask: peer.ask,
                        stake: peer.stake,
                        sha256: sha256.toString('hex'),
                    }),
                );
            }
        }
        await this.repositoryModuleManager.createManyPeerRecords(await Promise.all(promises));
    }

    async listenOnEvents(blockchainId) {
        this.eventEmitter.on(`${blockchainId}-NodeObjCreated`, async (event) => {
            const eventData = JSON.parse(event.data);
            this.logger.debug(
                `${blockchainId}-NodeObjCreated event caught, adding peer id: ${eventData.nodeId} to sharding table.`,
            );

            this.repositoryModuleManager.createPeerRecord(
                eventData.nodeId,
                event.blockchain_id,
                eventData.ask,
                eventData.stake,
                new Date(0),
                (
                    await this.networkModuleManager.toHash(
                        new TextEncoder().encode(eventData.nodeId),
                    )
                ).toString('hex'),
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

    async getBidSuggestion(neighbourhood, R0, higherPercentile) {
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

        const awardedNodes = eligibleNodesSortedByStake.slice(0, R0);

        return Math.max(...awardedNodes.map((node) => node.ask)) * R0;
    }

    async findEligibleNodes(neighbourhood, bid, R1, R0) {
        return neighbourhood.filter((node) => node.ask <= bid / R0).slice(0, R1);
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
