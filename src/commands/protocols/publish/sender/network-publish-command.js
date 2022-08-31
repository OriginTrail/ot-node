const NetworkProtocolCommand = require('../../common/network-protocol-command');
const { ERROR_TYPE, PUBLISH_TYPES } = require('../../../../constants/constants');

class NetworkPublishCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_START_ERROR;
    }

    getKeywords(command) {
        const { publishType } = command.data;

        if (publishType === PUBLISH_TYPES.INDEX) return [...command.data.keywords];

        return [command.data.assertionId];
    }

    getNextCommandData(command) {
        const { publishType, assertionId, blockchain, contract } = command.data;
        const assertionCommandData = { publishType, assertionId, blockchain, contract };

        if (publishType === PUBLISH_TYPES.ASSERTION) return assertionCommandData;

        return { ...assertionCommandData, tokenId: command.data.tokenId };
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
