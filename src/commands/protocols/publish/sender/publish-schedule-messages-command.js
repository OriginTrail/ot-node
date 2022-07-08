const ProtocolScheduleMessagesCommand = require('../../common/protocol-schedule-messages-command');
const { HANDLER_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

class PublishScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.startEvent = HANDLER_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_START;
    }

    getNextCommandData(command) {
        const { assertionId, metadata, ual } = command.data;
        return {
            assertionId,
            metadata,
            ual,
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
            errorType: ERROR_TYPE.PUBLISH_START_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishScheduleMessagesCommand;
