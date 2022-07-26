const { NETWORK_MESSAGE_TYPES, HANDLER_ID_STATUS } = require('../../constants/constants');
const BaseController = require('./base-controller');

class GetController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.handlerIdService = ctx.handlerIdService;
        this.getService = ctx.getService;
    }

    async handleHttpApiGetRequest(req, res) {
        const handlerId = await this.handlerIdService.generateHandlerId(
            HANDLER_ID_STATUS.GET.GET_START,
        );

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.GET.GET_INIT_START,
        );

        this.returnResponse(res, 202, {
            handlerId,
        });

        await this.repositoryModuleManager.createOperationRecord(
            this.getService.getOperationName(),
            handlerId,
            this.getService.getOperationStatus().IN_PROGRESS,
        );

        const { id } = req.query;

        this.logger.info(`Get for ${id} with handler id ${handlerId} initiated.`);

        const commandData = {
            handlerId,
            id,
        };

        const commandSequence = [
            'getLatestAssertionIdCommand',
            'localGetCommand',
            'networkGetCommand',
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
            HANDLER_ID_STATUS.GET.GET_INIT_END,
        );
    }

    async handleNetworkGetRequest(message, remotePeerId) {
        const { handlerId, keywordUuid, messageType } = message.header;
        const { ual, assertionId } = message.data;
        let commandName;
        const commandData = { ual, assertionId, remotePeerId, handlerId, keywordUuid };
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandName = 'handleGetInitCommand';
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandName = 'handleGetRequestCommand';
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

module.exports = GetController;
