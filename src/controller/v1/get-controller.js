const { NETWORK_MESSAGE_TYPES, OPERATION_ID_STATUS } = require('../../constants/constants');
const BaseController = require('./base-controller');

class GetController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.getService = ctx.getService;
    }

    async handleHttpApiGetRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.GET.GET_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.repositoryModuleManager.createOperationRecord(
            this.getService.getOperationName(),
            operationId,
            this.getService.getOperationStatus().IN_PROGRESS,
        );

        const { id } = req.body;

        this.logger.info(`Get for ${id} with operation id ${operationId} initiated.`);

        const commandData = {
            operationId,
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

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_INIT_END,
        );
    }

    async handleNetworkGetRequest(message, remotePeerId) {
        const { operationId, keywordUuid, messageType } = message.header;
        const { ual, assertionId } = message.data;
        let commandName;
        const commandData = { ual, assertionId, remotePeerId, operationId, keywordUuid };
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
