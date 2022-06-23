const BaseController = require('./base-controller');
const {
    NETWORK_PROTOCOLS,
    PUBLISH_METHOD,
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    PUBLISH_STATUS,
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
        this.repositoryModuleManager = ctx.repositoryModuleManager;
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

            this.logger.info(`Received assertion with ual: ${ual}`);

            const publishRecord = await this.repositoryModuleManager.createPublishRecord(
                PUBLISH_STATUS.IN_PROGRESS,
            );

            const commandData = {
                method,
                ual,
                handlerId,
                operationId,
                metadata,
                publishId: publishRecord.id,
                networkProtocol: NETWORK_PROTOCOLS.STORE,
            };

            const commandSequence = [
                'validateAssertionCommand',
                'insertAssertionCommand',
                'findNodesCommand',
                'publishStoreCommand',
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
        const { handlerId } = message.header;
        const { assertionId, ual } = message.data;
        const commandSequence = [];
        const commandData = { remotePeerId, handlerId, assertionId, ual };
        switch (message.header.messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandSequence.push('validateStoreInitCommand');
                commandSequence.push('handleStoreInitCommand');

                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandData.metadata = message.data.metadata;
                await this.handlerIdService.cacheHandlerIdData(handlerId, {
                    data: message.data.data,
                });

                commandSequence.push('validateStoreRequestCommand');
                commandSequence.push('insertStoreRequestCommand');
                commandSequence.push('handleStoreRequestCommand');

                break;
            default:
                throw Error('unknown messageType');
        }

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: commandData,
            transactional: false,
        });
    }
}

module.exports = PublishController;
