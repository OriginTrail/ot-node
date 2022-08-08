const NetworkProtocolCommand = require('../../common/network-protocol-command');
const { ERROR_TYPE, PUBLISH_TYPES } = require('../../../../constants/constants');

class NetworkPublishCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR;
    }

    getKeywords(command) {
        if (command.data.publishType === PUBLISH_TYPES.INDEX) return [...command.data.keywords];
        else return [command.data.assertionId];
    }

    /**
     * Builds default networkPublishCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkPublishCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = NetworkPublishCommand;
