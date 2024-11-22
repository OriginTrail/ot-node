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
        let dataSource;
        const [handleRequestCommand] = this.getCommandSequence(protocol);
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                // eslint-disable-next-line no-case-declarations
                dataSource = message.data;
                command.period = 5000;
                command.retries = 3;
                await this.operationIdService.cacheOperationIdData(operationId, {
                    assertionId: dataSource.assertionId,
                    assertion: message.data.assertion,
                });
                command.name = handleRequestCommand;
                command.data.keyword = message.data.keyword;
                command.data.agreementId = dataSource.agreementId;
                command.data.agreementData = dataSource.agreementData;
                break;
            default:
                throw Error('unknown message type');
        }

        command.data = {
            ...command.data,
            remotePeerId,
            operationId,
            keywordUuid,
            protocol,
            assertionId: dataSource.assertionId,
            blockchain: dataSource.blockchain,
            contract: dataSource.contract,
            tokenId: dataSource.tokenId,
            keyword: dataSource.keyword,
            hashFunctionId: message.data.hashFunctionId ?? CONTENT_ASSET_HASH_FUNCTION_ID,
            proximityScoreFunctionsPairId: dataSource.proximityScoreFunctionsPairId ?? 1,
        };

        await this.commandExecutor.add(command);
    }
}

export default PublishController;
