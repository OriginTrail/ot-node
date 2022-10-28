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
        this.listenOnEvents(blockchainId);
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
        const shardingTableLength = await this.blockchainModuleManager.getShardingTableLength(
            blockchainId,
        );
        let startingPeerId = await this.blockchainModuleManager.getShardingTableHead(blockchainId);
        const pageSize = 10;
        const shardingTable = [];

        this.logger.debug(
            `Started pulling ${shardingTableLength} nodes from blockchain sharding table.`,
        );

        // TODO: mark starting block and listen to events from that block
        while (shardingTable.length < shardingTableLength) {
            // eslint-disable-next-line no-await-in-loop
            const nodes = await this.blockchainModuleManager.getShardingTablePage(
                blockchainId,
                startingPeerId,
                pageSize,
            );
            shardingTable.push(...nodes.filter((node) => node.id !== '0x'));
            startingPeerId = nodes[nodes.length - 1].id;
        }

        this.logger.debug(
            `Finished pulling ${shardingTable.length} nodes from blockchain sharding table.`,
        );

        await this.repositoryModuleManager.createManyPeerRecords(
            shardingTable.map((peer) => ({
                peer_id: this.blockchainModuleManager.convertHexToAscii(blockchainId, peer.id),
                blockchain_id: blockchainId,
                ask: peer.ask,
                stake: peer.stake,
                sha256: peer.idSha256,
            })),
        );
    }

    listenOnEvents(blockchainId) {
        this.eventEmitter.on(`${blockchainId}-NodeObjCreated`, (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );

            this.logger.debug(
                `${blockchainId}-NodeObjCreated event caught, adding peer id: ${nodeId} to sharding table.`,
            );

            this.repositoryModuleManager.createPeerRecord(
                nodeId,
                event.blockchain_id,
                eventData.ask,
                eventData.stake,
                new Date(0),
                eventData.nodeIdSha256,
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-StakeUpdated`, (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.debug(
                `${blockchainId}-StakeUpdated event caught, updating stake value for peer id: ${nodeId} in sharding table.`,
            );
            this.repositoryModuleManager.updatePeerStake(nodeId, eventData.stake);

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-NodeRemoved`, (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.debug(
                `${blockchainId}-NodeRemoved event caught, removing peer id: ${nodeId} from sharding table.`,
            );
            this.repositoryModuleManager.removePeerRecord(nodeId);

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
        const { addresses } = await this.findPeerAddressAndProtocols(peerId);
        if (addresses.length) {
            if (peerId !== this.networkModuleManager.getPeerId().toB58String()) {
                this.logger.trace(`Dialing peer ${peerId}.`);
                try {
                    await this.networkModuleManager.dial(peerId);
                } catch (error) {
                    this.logger.warn(`Unable to dial peer ${peerId}. Error: ${error.message}`);
                }
            }

            await this.repositoryModuleManager.updatePeerRecordLastSeenAndLastDialed(peerId);
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
                const peer = await this.networkModuleManager.findPeer(peerId);
                peerInfo = { ...peerInfo, addresses: peer.multiaddrs };
            } catch (error) {
                this.logger.warn(`Unable to find peer ${peerId}. Error: ${error.message}`);
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
