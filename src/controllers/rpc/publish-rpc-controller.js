import BaseController from './base-rpc-controller.js';
import { NETWORK_MESSAGE_TYPES } from '../../constants/constants.js';

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
    }

    async v1_0_0HandleRequest(message, remotePeerId, protocol) {
        const { operationId, uuid, messageType } = message.header;

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
            uuid,
            protocol,
            assertionId: message.data.assertionId,
            blockchain: message.data.blockchain,
            contract: message.data.contract,
        };

        await this.commandExecutor.add(command);
    }
}

export default PublishController;
