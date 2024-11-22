import BaseController from './base-rpc-controller.js';
import {
    NETWORK_MESSAGE_TYPES,
    CONTENT_ASSET_HASH_FUNCTION_ID,
} from '../../constants/constants.js';

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
    }

    async v1_0_0HandleRequest(message, remotePeerId, protocol) {
        const { operationId, keywordUuid, messageType } = message.header;

        const command = { sequence: [], delay: 0, transactional: false, data: {} };
        const [handleRequestCommand] = this.getCommandSequence(protocol);
        if (messageType === NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST) {
            Object.assign(command, {
                name: handleRequestCommand,
                period: 5000,
                retries: 3,
            });

            await this.operationIdService.cacheOperationIdData(operationId, {
                assertion: message.data.assertion,
            });
        } else {
            throw new Error('Unknown message type');
        }

        command.data = {
            ...command.data,
            remotePeerId,
            operationId,
            keywordUuid,
            protocol,
            assertionId: message.data.assertionId,
            blockchain: message.data.blockchain,
            contract: message.data.contract,
            tokenId: message.data.tokenId,
            keyword: message.data.keyword,
            hashFunctionId: message.data.hashFunctionId ?? CONTENT_ASSET_HASH_FUNCTION_ID,
            proximityScoreFunctionsPairId: message.data.proximityScoreFunctionsPairId ?? 2,
        };

        await this.commandExecutor.add(command);
    }
}

export default PublishController;
