import Command from '../../command.js';
import { NETWORK_MESSAGE_TYPES, OPERATION_ID_STATUS } from '../../../constants/constants.js';

class HandleProtocolMessageCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.ualService = ctx.ualService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.operationIdService = ctx.operationIdService;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.operationStartEvent = OPERATION_ID_STATUS.HANDLE_PROTOCOL_MESSAGE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.HANDLE_PROTOCOL_MESSAGE_END;
        this.prepareMessageStartEvent =
            OPERATION_ID_STATUS.HANDLE_PROTOCOL_MESSAGE_PREPARE_MESSAGE_START;
        this.prepareMessageEndEvent =
            OPERATION_ID_STATUS.HANDLE_PROTOCOL_MESSAGE_PREPARE_MESSAGE_END;
        this.sendMessageResponseStartEvent =
            OPERATION_ID_STATUS.HANDLE_PROTOCOL_MESSAGE_SEND_MESSAGE_RESPONSE_START;
        this.sendMessageResponseEndEvent =
            OPERATION_ID_STATUS.HANDLE_PROTOCOL_MESSAGE_SEND_MESSAGE_RESPONSE_END;
        this.removeCachedSessionStartEvent =
            OPERATION_ID_STATUS.HANDLE_PROTOCOL_MESSAGE_REMOVE_CACHED_SESSION_START;
        this.removeCachedSessionEndEvent =
            OPERATION_ID_STATUS.HANDLE_PROTOCOL_MESSAGE_REMOVE_CACHED_SESSION_END;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { remotePeerId, operationId, protocol, blockchain } = command.data;

        this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.operationStartEvent,
        );

        try {
            this.operationIdService.emitChangeEvent(
                this.prepareMessageStartEvent,
                operationId,
                blockchain,
            );
            const { messageType, messageData } = await this.prepareMessage(command.data);
            this.operationIdService.emitChangeEvent(
                this.prepareMessageEndEvent,
                operationId,
                blockchain,
            );

            this.operationIdService.emitChangeEvent(
                this.sendMessageResponseStartEvent,
                operationId,
                blockchain,
            );
            await this.networkModuleManager.sendMessageResponse(
                protocol,
                remotePeerId,
                messageType,
                operationId,
                messageData,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                this.operationEndEvent,
            );
        } catch (error) {
            if (command.retries) {
                this.logger.warn(error.message);
                return Command.retry();
            }
            await this.handleError(error.message, command);
        }

        this.operationIdService.emitChangeEvent(
            this.removeCachedSessionStartEvent,
            operationId,
            blockchain,
        );
        this.networkModuleManager.removeCachedSession(operationId, remotePeerId);
        this.operationIdService.emitChangeEvent(
            this.removeCachedSessionEndEvent,
            operationId,
            blockchain,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            this.operationEndEvent,
        );

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

    async validateAssertionMerkleRoot(blockchain, contract, tokenId, assertionMerkleRoot, ual) {
        const blockchainAssertionMerkleRoot =
            await this.blockchainModuleManager.getKnowledgeCollectionMerkleRoot(
                blockchain,
                contract,
                tokenId,
            );
        if (blockchainAssertionMerkleRoot !== assertionMerkleRoot) {
            throw Error(
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionMerkleRoot}, received value from request: ${assertionMerkleRoot}`,
            );
        }
    }

    async validateReceivedData(
        operationId,
        assertionMerkleRoot,
        assertion,
        blockchain,
        isOperationV0,
    ) {
        this.logger.trace(`Validating shard for assertionMerkleRoot: ${assertionMerkleRoot}`);
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

        if (!isOperationV0) {
            try {
                await this.validationService.validateAssertionMerkleRoot(
                    assertion,
                    assertionMerkleRoot,
                );
            } catch (error) {
                return {
                    messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                    messageData: {
                        errorMessage: error.message,
                    },
                };
            }
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
