import BaseController from './base-rpc-controller.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    NETWORK_MESSAGE_TYPES,
} from '../../constants/constants.js';

class UpdateController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
    }

    async v1_0_0HandleRequest(message, remotePeerId, protocol) {
        const { operationId, messageType } = message.header;

        const command = { sequence: [], delay: 0, transactional: false, data: {} };
        let dataSource;
        const [handleInitCommand, handleRequestCommand] = this.getCommandSequence(protocol);
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                dataSource = message.data;
                command.name = handleInitCommand;
                command.period = 5000;
                command.retries = 3;
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                // eslint-disable-next-line no-case-declarations
                dataSource = await this.operationIdService.getCachedOperationIdData(operationId);
                await this.operationIdService.cacheOperationIdData(operationId, {
                    assertionId: dataSource.assertionId,
                    assertion: message.data.assertion,
                });
                command.name = handleRequestCommand;
                break;
            default:
                throw Error('unknown message type');
        }

        command.data = {
            ...command.data,
            remotePeerId,
            operationId,
            protocol,
            assertionId: dataSource.assertionId,
            blockchain: dataSource.blockchain,
            contract: dataSource.contract,
            tokenId: dataSource.tokenId,
            keyword: dataSource.keyword,
            hashFunctionId: dataSource.hashFunctionId ?? CONTENT_ASSET_HASH_FUNCTION_ID,
        };

        await this.commandExecutor.add(command);
    }
}

export default UpdateController;
