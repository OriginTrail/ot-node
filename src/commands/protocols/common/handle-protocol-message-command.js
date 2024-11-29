import Command from '../../command.js';
import { NETWORK_MESSAGE_TYPES } from '../../../constants/constants.js';

class HandleProtocolMessageCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId, operationId, protocol } = command.data;

        try {
            const { messageType, messageData } = await this.prepareMessage(command.data);
            await this.networkModuleManager.sendMessageResponse(
                protocol,
                remotePeerId,
                messageType,
                operationId,
                messageData,
            );
        } catch (error) {
            if (command.retries) {
                this.logger.warn(error.message);
                return Command.retry();
            }
            await this.handleError(error.message, command);
        }

        this.networkModuleManager.removeCachedSession(operationId, remotePeerId);

        return Command.empty();
    }

    async prepareMessage() {
        throw Error('prepareMessage not implemented');
    }

    async validateShard(blockchain) {
        const peerId = this.networkModuleManager.getPeerId().toB58String();
        const isNodePartOfShard = await this.shardingTableService.isNodePartOfShard(
            blockchain,
            peerId,
        );

        return isNodePartOfShard;
    }

    async validateAssertionId(blockchain, contract, tokenId, assertionId, ual) {
        const blockchainAssertionId = await this.blockchainModuleManager.getLatestAssertionId(
            blockchain,
            contract,
            tokenId,
        );
        if (blockchainAssertionId !== assertionId) {
            throw Error(
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${assertionId}`,
            );
        }
    }

    async validateReceivedData(operationId, datasetRoot, dataset, blockchain) {
        this.logger.trace(`Validating shard for datasetRoot: ${datasetRoot}`);
        const isShardValid = await this.validateShard(blockchain);
        if (!isShardValid) {
            this.logger.warn(
                `Invalid shard on blockchain: ${blockchain}, operationId: ${operationId}`,
            );
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: { errorMessage: 'Invalid neighbourhood' },
            };
        }

        const isValidAssertion = await this.validationService.validateDatasetRoot(
            dataset,
            datasetRoot,
        );

        if (!isValidAssertion) {
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: {
                    errorMessage: `Invalid dataset root for asset ???. Received value , received value from request: ${datasetRoot}`,
                },
            };
        }

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async handleError(errorMessage, command) {
        const { operationId, blockchain, remotePeerId, protocol } = command.data;

        await super.handleError(operationId, blockchain, errorMessage, this.errorType, true);
        await this.networkModuleManager.sendMessageResponse(
            protocol,
            remotePeerId,
            NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            operationId,
            { errorMessage },
        );
        this.networkModuleManager.removeCachedSession(operationId, remotePeerId);
    }
}

export default HandleProtocolMessageCommand;
