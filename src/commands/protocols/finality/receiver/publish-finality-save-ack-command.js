import {
    COMMAND_PRIORITY,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
} from '../../../../constants/constants.js';
import Command from '../../../command.js';

class PublishFinalitySaveAckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.protocolService = ctx.protocolService;
        this.operationService = ctx.finalityService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { ual, publishOperationId, blockchain, operationId, remotePeerId } = command.data;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FINALITY.PUBLISH_FINALITY_REMOTE_START,
        );

        let response;
        let success;
        try {
            await this.repositoryModuleManager.saveFinalityAck(
                publishOperationId,
                ual,
                remotePeerId,
            );

            success = true;
            response = {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                messageData: { message: `Acknowledged storing of ${ual}.` },
            };
        } catch (err) {
            success = false;
            response = {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: { errorMessage: `Failed to acknowledge storing of ${ual}.` },
            };
        }

        await this.operationService.markOperationAsCompleted(operationId, blockchain, success, [
            OPERATION_ID_STATUS.FINALITY.PUBLISH_FINALITY_FETCH_FROM_NODES_END,
            OPERATION_ID_STATUS.FINALITY.PUBLISH_FINALITY_END,
            OPERATION_ID_STATUS.COMPLETED,
        ]);
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.FINALITY.PUBLISH_FINALITY_REMOTE_END,
        );

        return this.continueSequence({ ...command.data, response }, command.sequence);
    }

    /**
     * Builds default publishFinalitySaveAckCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishFinalitySaveAckCommand',
            delay: 0,
            transactional: false,
            priority: COMMAND_PRIORITY.HIGHEST,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishFinalitySaveAckCommand;
