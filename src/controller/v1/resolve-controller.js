const {
    HANDLER_ID_STATUS,
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS
} = require('../../constants/constants');
const BaseController = require('./base-controller');

class ResolveController extends BaseController {
    async handleHttpApiResolveRequest(req, res) {
        const operationId = this.generateOperationId();

        const { id } = req.body;

        const handlerId = await this.handlerIdService.generateHandlerId();

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.VALIDATING_ID,
        );

        this.returnResponse(res, 202, {
            handlerId,
        });

        this.logger.info(`Resolve for ${id} with handler id ${handlerId} initiated.`);

        const commandData = {
            handlerId,
            operationId,
            id,
            networkProtocol: NETWORK_PROTOCOLS.RESOLVE,
        };

        const commandSequence = [
            'getAssertionCommand',
            'localResolveCommand',
            'findNodesCommand',
            'resolveCommand',
        ];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: commandData,
            transactional: false,
        });

        
    }

    async handleNetworkResolveRequest(message, remotePeerId) {
        const operationId = await this.generateHandlerId();
        let commandName;
        const commandData = { message, remotePeerId, operationId };
        switch (message.header.messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandName = 'handleResolveInitCommand';
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandName = 'handleResolveRequestCommand';
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

module.exports = ResolveController;
