import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class PublishScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.blockchainModuleManager = ctx.blockchainModuleManager; // this should be removed (???)
        this.repositoryModuleManager = ctx.repositoryModuleManager; // this should be removed (???)

        this.operationStartEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_END;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR;
    }

    getNextCommandData(command) {
        const { datasetRoot, blockchain, isOperationV0, contract, tokenId } = command.data;
        return {
            blockchain,
            datasetRoot,
            isOperationV0,
            contract,
            tokenId,
        };
    }

    /**
     * Builds default publishScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishScheduleMessagesCommand;
