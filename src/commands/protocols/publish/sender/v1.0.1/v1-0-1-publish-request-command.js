import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { ERROR_TYPE, PUBLISH_TYPES } from '../../../../../constants/constants.js';

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
            name: 'v1_0_1PublishRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishRequestCommand;
