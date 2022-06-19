const BaseController = require('./base-controller');
const {
    NETWORK_PROTOCOLS,
    PUBLISH_METHOD,
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
} = require('../../constants/constants');

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
        try {
            const metadataNquads = await this.dataService.metadataObjectToNquads(metadata);

            await this.handlerIdService.cacheHandlerIdData(handlerId, {
                data,
                metadata: metadataNquads,
            });

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
                networkProtocol: NETWORK_PROTOCOLS.STORE,
            };

            const commandSequence = [
                // 'validateAssertionCommand',
                'insertAssertionCommand',
                'findNodesCommand',
                'storeCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        } catch (error) {
            this.logger.error({
                msg: `Error while initializing publish data: ${error.message}. ${error.stack}`,
                Event_name: ERROR_TYPE.PUBLISH_ROUTE_ERROR,
                Event_value1: error.message,
                Id_operation: operationId,
            });
            await this.handlerIdService.updateFailedHandlerId(
                handlerId,
                'Unable to publish data, Failed to process input data!',
            );
        }
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
