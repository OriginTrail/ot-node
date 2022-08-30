const ProtocolRequestCommand = require('../../common/protocol-request-command');
const { ERROR_TYPE, PUBLISH_TYPES } = require('../../../../constants/constants');

class PublishRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const { publishType, operationId, assertionId, blockchain, contract } = command.data;
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);

        const assertionMessage = {
            publishType,
            assertionId,
            blockchain,
            contract,
            assertion,
        };

        if (publishType === PUBLISH_TYPES.ASSERTION) return assertionMessage;

        if (publishType === PUBLISH_TYPES.ASSET)
            return { ...assertionMessage, tokenId: command.data.tokenId };

        return {
            ...assertionMessage,
            tokenId: command.data.tokenId,
            keyword: command.data.keyword,
        };
    }

    /**
     * Builds default storeRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishRequestCommand;
