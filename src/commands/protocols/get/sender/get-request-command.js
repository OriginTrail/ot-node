const ProtocolRequestCommand = require('../../common/protocol-request-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class GetRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
    }

    async prepareMessage(command) {
        const { ual, assertionId } = command.data;

        return { ual, assertionId };
    }

    /**
     * Builds default getRequest
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getRequestCommand',
            delay: 0,
            retries: 0,
            transactional: false,
            errorType: ERROR_TYPE.GET_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = GetRequestCommand;
