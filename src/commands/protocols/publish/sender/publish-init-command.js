const ProtocolInitCommand = require('../../common/protocol-init-command');
const { ERROR_TYPE, PUBLISH_TYPES } = require('../../../../constants/constants');

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
        else return { ...assertionMessage, tokenId: command.data.tokenId };
    }

    /**
     * Builds default publishInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishInitCommand;
