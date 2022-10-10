import { NETWORK_MESSAGE_TYPES } from '../../constants/constants.js';
import BaseController from './base-rpc-controller.js';

class GetController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationService = ctx.getService;
    }

    async v1_0_0HandleRequest(message, remotePeerId, protocol) {
        const { operationId, keywordUuid, messageType } = message.header;
        const { assertionId } = message.data;
        let commandName;
        const commandData = { assertionId, remotePeerId, operationId, keywordUuid };
        const [handleInitCommand, handleRequestCommand] = this.getCommandSequence(protocol);
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandName = handleInitCommand;
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandName = handleRequestCommand;
                break;
            default:
                throw Error('unknown messageType');
        }

        await this.commandExecutor.add({
            name: commandName,
            sequence: [],
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }
}

export default GetController;
