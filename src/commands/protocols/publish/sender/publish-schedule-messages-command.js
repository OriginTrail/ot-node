const ProtocolScheduleMessagesCommand = require('../../common/protocol-schedule-messages-command');
const { OPERATION_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

class PublishScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.startEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_REPLICATE_START;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR;
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
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishScheduleMessagesCommand;
