const {
    NETWORK_MESSAGE_TYPES,
    NETWORK_PROTOCOLS, HANDLER_ID_STATUS,
} = require('../../constants/constants');
const BaseController = require('./base-controller');

class ResolveController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.handlerIdService = ctx.handlerIdService;
    }

    async handleHttpApiResolveRequest(req, res) {
        const { id } = req.body;

        const handlerId = await this.handlerIdService.generateHandlerId();
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_START
        );
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_INIT_START
        );

        this.returnResponse(res, 202, {
            handlerId,
        });

        this.logger.info(`Resolve for ${id} with handler id ${handlerId} initiated.`);

        const commandData = {
            handlerId,
            id,
            networkProtocol: NETWORK_PROTOCOLS.RESOLVE,
        };

        const commandSequence = [
            'getLatestAssertionIdCommand',
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

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.RESOLVE_INIT_END
        );
    }

    async handleNetworkResolveRequest(message, remotePeerId) {
        const { handlerId } = message.header;
        const { assertionId } = message.data;
        let commandName;
        const commandData = { assertionId, remotePeerId, handlerId };
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
