import { ethers } from 'ethers';
import { CONTENT_ASSET_HASH_FUNCTION_ID, CONTRACT_EVENTS } from '../constants/constants.js';

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
        this.listenOnStakingEvents(blockchainId);
        this.listenOnProfileEvents(blockchainId);
        this.listenOnCommitManagerEvents(blockchainId);
    }

    listenOnShardingTableEvents(blockchainId) {
        const nodeAddedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.SHARDING_TABLE.NODE_ADDED,
        );
        this.eventEmitter.on(nodeAddedEvent, async (event) => {
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
                `${nodeAddedEvent} event caught, adding peer id: ${nodeId} to sharding table.`,
            );

            await this.repositoryModuleManager.createPeerRecord(
                nodeId,
                event.blockchain_id,
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.ask, 'ether'),
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.stake, 'ether'),
                new Date(0),
                nodeIdSha256,
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        const nodeRemovedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.SHARDING_TABLE.NODE_REMOVED,
        );
        this.eventEmitter.on(nodeRemovedEvent, async (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${nodeRemovedEvent} event caught, removing peer id: ${nodeId} from sharding table.`,
            );
            await this.repositoryModuleManager.removePeerRecord(blockchainId, nodeId);

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
    }

    listenOnStakingEvents(blockchainId) {
        const stakeIncreasedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.STAKING.STAKE_INCREASED,
        );
        this.eventEmitter.on(stakeIncreasedEvent, async (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${stakeIncreasedEvent} event caught, updating stake value for peer id: ${nodeId} in sharding table.`,
            );
            await this.repositoryModuleManager.updatePeerStake(
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

        const stakeWithdrawalStartedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.STAKING.STAKE_WITHDRAWAL_STARTED,
        );
        this.eventEmitter.on(stakeWithdrawalStartedEvent, async (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${stakeWithdrawalStartedEvent} event caught, updating stake value for peer id: ${nodeId} in sharding table.`,
            );
            await this.repositoryModuleManager.updatePeerStake(
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
    }

    listenOnProfileEvents(blockchainId) {
        const askUpdatedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.PROFILE.ASK_UPDATED,
        );
        this.eventEmitter.on(askUpdatedEvent, async (event) => {
            const eventData = JSON.parse(event.data);
            const nodeId = this.blockchainModuleManager.convertHexToAscii(
                event.blockchain_id,
                eventData.nodeId,
            );
            this.logger.trace(
                `${askUpdatedEvent} event caught, updating ask value for peer id: ${nodeId} in sharding table.`,
            );
            await this.repositoryModuleManager.updatePeerAsk(
                blockchainId,
                nodeId,
                this.blockchainModuleManager.convertFromWei(blockchainId, eventData.ask, 'ether'),
            );
            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
    }

    listenOnCommitManagerEvents(blockchainId) {
        const stateFinalizedEvent = this.getBlockchainEventName(
            blockchainId,
            CONTRACT_EVENTS.COMMIT_MANAGER_V1.STATE_FINALIZED,
        );
        this.eventEmitter.on(stateFinalizedEvent, () => {
            this.logger.trace(`${stateFinalizedEvent} event caught.`);
        });
    }

    getBlockchainEventName(blockchainId, eventName) {
        return `${blockchainId}-${eventName}`;
    }
}

export default EventListenerService;
