import ProtocolInitCommand from '../../../common/protocol-init-command.js';
import { ERROR_TYPE, PUBLISH_TYPES } from '../../../../../constants/constants.js';

class PublishInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { publishType, assertionId, blockchain, contract } = command.data;
        const assertionMessage = { publishType, assertionId, blockchain, contract };

        if (publishType === PUBLISH_TYPES.ASSERTION) return assertionMessage;

        return { ...assertionMessage, tokenId: command.data.tokenId };
    }

    /**
     * Builds default publishInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_1PublishInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishInitCommand;
