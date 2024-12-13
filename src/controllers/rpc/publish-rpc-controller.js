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
        const { operationId, messageType } = message.header;

        const command = { sequence: [], delay: 0, transactional: false, data: {} };
        const [handleRequestCommand] = this.getCommandSequence(protocol);
        if (messageType === NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST) {
            Object.assign(command, {
                name: handleRequestCommand,
                period: 5000,
                retries: 3,
            });

            await this.operationIdService.cacheOperationIdDataToMemory(operationId, {
                assertion: message.data.assertion,
                assertionMerkleRoot: message.data.assertionMerkleRoot,
            });

            await this.operationIdService.cacheOperationIdDataToFile(operationId, {
                assertion: message.data.assertion,
                assertionMerkleRoot: message.data.assertionMerkleRoot,
            });
        } else {
            throw new Error('Unknown message type');
        }

        command.data = {
            ...command.data,
            remotePeerId,
            operationId,
            protocol,
            assertion: message.data.assertion,
            assertionMerkleRoot: message.data.assertionMerkleRoot,
            blockchain: message.data.blockchain,
            isOperationV0: message.data.isOperationV0,
        };

        await this.commandExecutor.add(command);
    }
}

export default PublishController;
