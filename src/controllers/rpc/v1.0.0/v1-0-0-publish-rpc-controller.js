import BaseController from '../base-rpc-controller.js';
import { NETWORK_MESSAGE_TYPES } from '../../../constants/constants.js';

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
    }

    async handleRequest(message, remotePeerId, protocol) {
        const { operationId, keywordUuid, messageType } = message.header;
        const { assertionId, ual } = message.data;
        const command = {
            sequence: [],
            delay: 0,
            data: {
                remotePeerId,
                operationId,
                keywordUuid,
                assertionId,
                ual,
            },
            transactional: false,
        };

        const [handleInitCommand, handleRequestCommand] = this.getCommandSequence(protocol);
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                command.name = handleInitCommand;
                command.period = 5000;
                command.retries = 3;

                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                // eslint-disable-next-line no-case-declarations
                const { assertionId: cachedAssertionId } =
                    await this.operationIdService.getCachedOperationIdData(operationId);
                await this.operationIdService.cacheOperationIdData(operationId, {
                    assertionId: cachedAssertionId,
                    assertion: message.data.assertion,
                });
                command.name = handleRequestCommand;
                command.data.keyword = message.data.keyword;
                break;
            default:
                throw Error('unknown messageType');
        }
        await this.commandExecutor.add(command);
    }
}

export default PublishController;
