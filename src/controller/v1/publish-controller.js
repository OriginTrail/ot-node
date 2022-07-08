const BaseController = require('./base-controller');
const { PUBLISH_METHOD, ERROR_TYPE, NETWORK_MESSAGE_TYPES } = require('../../constants/constants');
const { HANDLER_ID_STATUS } = require('../../constants/constants');

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
        const handlerId = await this.handlerIdService.generateHandlerId(
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_START,
        );

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_INIT_START,
        );

        this.returnResponse(res, 202, {
            handlerId,
        });

        const { metadata, data, ual } = req.body;
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.PUBLISH.PUBLISH_INIT_END,
        );
        try {
            await this.repositoryModuleManager.createOperationRecord(
                this.publishService.getOperationName(),
                handlerId,
                this.publishService.getOperationStatus().IN_PROGRESS,
            );

            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.PUBLISH.PUBLISH_GENERATE_METADATA_START,
            );
            const metadataNquads = await this.dataService.metadataObjectToNquads(metadata);
            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.PUBLISH.PUBLISH_GENERATE_METADATA_END,
            );

            await this.handlerIdService.cacheHandlerIdData(handlerId, {
                data,
                metadata: metadataNquads,
            });

            this.logger.info(`Received assertion with ual: ${ual}`);

            const commandData = {
                method,
                ual,
                handlerId,
                metadata,
            };

            const commandSequence = [
                'validateAssertionCommand',
                // 'insertAssertionCommand',
                'networkPublishCommand',
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
                Id_operation: handlerId,
            });
            await this.handlerIdService.updateHandlerIdStatus(
                handlerId,
                HANDLER_ID_STATUS.FAILED,
                'Unable to publish data, Failed to process input data!',
            );
        }
    }

    async handleNetworkStoreRequest(message, remotePeerId) {
        const { handlerId, keyword, messageType } = message.header;
        const { assertionId, ual } = message.data;
        const commandSequence = [];
        const commandData = { remotePeerId, handlerId, keyword, assertionId, ual };
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                commandSequence.push('validateStoreInitCommand');
                commandSequence.push('handleStoreInitCommand');

                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                commandData.metadata = message.data.metadata;
                await this.handlerIdService.cacheHandlerIdData(handlerId, {
                    data: message.data.data,
                    metadata: await this.dataService.metadataObjectToNquads(message.data.metadata),
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
