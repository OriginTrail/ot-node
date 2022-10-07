import ProtocolRequestCommand from '../../../common/protocol-request-command.js';
import { ERROR_TYPE } from '../../../../../constants/constants.js';

class PublishRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_STORE_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const { operationId, assertionId, blockchain, contract, tokenId } = command.data;
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);

        return {
            assertionId,
            ual: this.ualService.deriveUAL(blockchain, contract, tokenId),
            assertion,
        };
    }

    /**
     * Builds default storeRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0PublishRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishRequestCommand;
