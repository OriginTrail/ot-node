import { ethers } from 'ethers';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
} from '../constants/constants.js';

class EventListenerService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.validationModuleManager = ctx.validationModuleManager;
        this.eventEmitter = ctx.eventEmitter;
    }

    initialize() {
        for (const blockchainId of this.blockchainModuleManager.getImplementationNames()) {
            this.listenOnEvents(blockchainId);
            this.logger.info(`Event listener initialized for '${blockchainId}' blockchain`);
        }
    }

    listenOnEvents(blockchainId) {
        this.listenOnShardingTableEvents(blockchainId);
        this.listenOnCommitManagerEvents(blockchainId);
    }

    listenOnShardingTableEvents(blockchainId) {
        this.eventEmitter.on(`${blockchainId}-NodeAdded`, async (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );

            const nodeIdSha256 = await this.validationModuleManager.callHashFunction(
                // TODO: How to add more hashes?
                CONTENT_ASSET_HASH_FUNCTION_ID,
                nodeId,
            );

            this.logger.trace(
                `${blockchainId}-NodeAdded event caught, adding peer id: ${nodeId} to sharding table.`,
            );

            this.repositoryModuleManager.createPeerRecord(
                nodeId,
                event.blockchain_id,
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.ask, 'ether'),
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.stake, 'ether'),
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

        this.eventEmitter.on(`${blockchainId}-StakeIncreased`, async (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${blockchainId}-StakeIncreased event caught, updating stake value for peer id: ${nodeId} in sharding table.`,
            );
            this.repositoryModuleManager.updatePeerStake(
                blockchainId,
                nodeId,
                ethers.utils.formatUnits(
                    await this.blockchainModuleManager.getNodeStake(
                        blockchainId,
                        eventData.identityId,
                    ),
                    'ether',
                ),
            );
            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-StakeWithdrawalStarted`, async (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${blockchainId}-StakeWithdrawalStarted event caught, updating stake value for peer id: ${nodeId} in sharding table.`,
            );
            this.repositoryModuleManager.updatePeerStake(
                blockchainId,
                nodeId,
                ethers.utils.formatUnits(
                    await this.blockchainModuleManager.getNodeStake(
                        blockchainId,
                        eventData.identityId,
                    ),
                    'ether',
                ),
            );
            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-AskUpdated`, (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${blockchainId}-AskUpdated event caught, updating ask value for peer id: ${nodeId} in sharding table.`,
            );
            this.repositoryModuleManager.updatePeerAsk(
                blockchainId,
                nodeId,
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.ask, 'ether'),
            );
            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
    }

    listenOnCommitManagerEvents(blockchainId) {
        this.eventEmitter.on(`${blockchainId}-StateFinalized`, () => {
            this.logger.trace(`${blockchainId}-StateFinalized event caught.`);
        });
    }
}

export default EventListenerService;
