import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import { ERROR_TYPE, OPERATION_ID_STATUS } from '../../../../../constants/constants.js';

class HandleFinalityRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.finalityService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.paranetService = ctx.paranetService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.FINALITY.FINALITY_REQUEST_REMOTE_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_END;
        this.prepareMessageStartEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_PREPARE_MESSAGE_START;
        this.prepareMessageEndEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_PREPARE_MESSAGE_END;
        this.sendMessageResponseStartEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_SEND_MESSAGE_START;
        this.sendMessageResponseEndEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_SEND_MESSAGE_END;
        this.removeCachedSessionStartEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_REMOVE_CACHED_SESSION_START;
        this.removeCachedSessionEndEvent =
            OPERATION_ID_STATUS.FINALITY.FINALITY_REMOTE_REMOVE_CACHED_SESSION_END;
    }

    async prepareMessage(commandData) {
        return commandData.response;
    }

    /**
     * Builds default handleFinalityRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleFinalityRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.FINALITY.FINALITY_REQUEST_REMOTE_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleFinalityRequestCommand;
