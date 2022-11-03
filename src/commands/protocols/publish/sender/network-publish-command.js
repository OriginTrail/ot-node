import NetworkProtocolCommand from '../../common/network-protocol-command.js';
import { ERROR_TYPE, PUBLISH_TYPES } from '../../../../constants/constants.js';

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

export default NetworkPublishCommand;
