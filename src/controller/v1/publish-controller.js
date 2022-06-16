const { PUBLISH_METHOD } = require('../../../modules/constants');
const BaseController = require('./base-controller');
const { NETWORK_MESSAGE_TYPES } = require('../../../modules/constants');

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.workerPool = ctx.workerPool;
        this.publishService = ctx.publishService;
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.commandExecutor = ctx.commandExecutor;
        this.dataService = ctx.dataService;
        this.handlerIdService = ctx.handlerIdService;
    }

    async handleHttpApiPublishRequest(req, res) {
        return this.handleHttpApiPublishMethod(req, res, PUBLISH_METHOD.PUBLISH);
    }

    handleHttpApiProvisionRequest(req, res) {
        return this.handleHttpApiPublishMethod(req, res, PUBLISH_METHOD.PROVISION);
    }

    handleHttpApiUpdateRequest(req, res) {
        return this.handleHttpApiPublishMethod(req, res, PUBLISH_METHOD.UPDATE);
    }

    async handleHttpApiPublishMethod(req, res, method) {
        const operationId = this.generateOperationId();

        const handlerId = await this.handlerIdService.generateHandlerId();

        this.returnResponse(res, 202, {
            handlerId,
        });

        const { metadata, data, ual } = req.body;

        await this.handlerIdService.cacheHandlerIdData(handlerId, { data, metadata });

        const { keywords, dataRootId, issuer, visibility, type } = metadata;
        this.logger.info(`Received assertion with ual: ${ual}`);
        const commandData = {
            method,
            ual,
            handlerId,
            operationId,
            keywords,
            dataRootId,
            issuer,
            visibility,
            type,
        };

        const commandSequence = [
            'validateAssertionCommand',
            'insertAssertionCommand',
            'findNodesCommand',
            'storeInitCommand',
            'storeRequestCommand',
        ];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }

    async handleNetworkStoreRequest(message, remotePeerId) {
        const operationId = await this.generateHandlerId();
        let commandName;
        const commandData = { message, remotePeerId, operationId };
        switch (message.header.messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandName = 'handleStoreInitCommand';
                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandName = 'handleStoreRequestCommand';
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

module.exports = PublishController;
