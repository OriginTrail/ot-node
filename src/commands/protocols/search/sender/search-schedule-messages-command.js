const ProtocolScheduleMessagesCommand = require('../../common/protocol-schedule-messages-command');
const { OPERATION_ID_STATUS, ERROR_TYPE } = require('../../../../constants/constants');

class SearchScheduleMessagesCommand extends ProtocolScheduleMessagesCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.searchService;

        this.errorType = ERROR_TYPE.SEARCH.SEARCH_SCHEDULE_MESSAGES_COMMAND;
        this.startEvent = 'todo';
    }

    getNextCommandData(command) {
        const { limit, offset } = command.data;
        return { limit, offset };
    }

    /**
     * Builds default searchScheduleMessagesCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'searchScheduleMessagesCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SearchScheduleMessagesCommand;
