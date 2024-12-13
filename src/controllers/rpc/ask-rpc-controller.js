import { NETWORK_MESSAGE_TYPES } from '../../constants/constants.js';
import BaseController from './base-rpc-controller.js';

class AskController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationService = ctx.askService;
    }

    async v1_0_0HandleRequest(message, remotePeerId, protocol) {
        const { operationId, messageType } = message.header;
        const [handleRequestCommand] = this.getCommandSequence(protocol);
        let commandName;
        switch (messageType) {
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
            data: {
                remotePeerId,
                operationId,
                protocol,
                ual: message.data.ual,
                numberOfFoundNodes: message.data.numberOfFoundNodes,
                blockchain: message.data.blockchain,
            },
            transactional: false,
        });
    }
}

export default AskController;
