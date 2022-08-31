import ProtocolScheduleMessagesCommand from '../../common/protocol-schedule-messages-command.js';
import { OPERATION_ID_STATUS, PUBLISH_TYPES, ERROR_TYPE } from '../../../../constants/constants.js';

class PublishScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.startEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_START;
        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR;
    }

    getNextCommandData(command) {
        const { publishType, assertionId, blockchain, contract } = command.data;
        const assertionCommandData = { publishType, assertionId, blockchain, contract };

        if (publishType === PUBLISH_TYPES.ASSERTION) return assertionCommandData;
        return { ...assertionCommandData, tokenId: command.data.tokenId };
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
