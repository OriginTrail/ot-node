const BaseController = require('./base-controller');
const { PUBLISH_METHOD, ERROR_TYPE, NETWORK_MESSAGE_TYPES } = require('../../constants/constants');
const { OPERATION_ID_STATUS } = require('../../constants/constants');

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.workerPool = ctx.workerPool;
        this.publishService = ctx.publishService;
        this.logger = ctx.logger;
        this.fileService = ctx.fileService;
        this.commandExecutor = ctx.commandExecutor;
        this.dataService = ctx.dataService;
        this.operationIdService = ctx.operationIdService;
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
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_INIT_START,
        );

        this.returnResponse(res, 202, {
            operation_id: operationId,
        });

        const { assertion, options } = req.body;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_INIT_END,
        );
        try {
            await this.repositoryModuleManager.createOperationRecord(
                this.publishService.getOperationName(),
                operationId,
                this.publishService.getOperationStatus().IN_PROGRESS,
            );

            await this.operationIdService.cacheOperationIdData(operationId, { assertion });

            this.logger.info(`Received assertion with ual: ${options.ual}`);

            const commandData = {
                method,
                ual: options.ual,
                operationId,
            };

            const commandSequence = ['validateAssertionCommand', 'networkPublishCommand'];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                period: 5000,
                retries: 3,
                data: commandData,
                transactional: false,
            });
        } catch (error) {
            this.logger.error(
                `Error while initializing publish data: ${error.message}. ${error.stack}`,
            );
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.FAILED,
                'Unable to publish data, Failed to process input data!',
                ERROR_TYPE.PUBLISH.PUBLISH_ROUTE_ERROR,
            );
        }
    }

    async handleNetworkStoreRequest(message, remotePeerId) {
        const { operationId, keywordUuid, messageType } = message.header;
        const { assertionId, ual } = message.data;
        const command = {
            delay: 0,
            data: { remotePeerId, operationId, keywordUuid, assertionId, ual },
            transactional: false,
        };
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                command.name = 'validateStoreInitCommand';
                command.sequence = ['handleStoreInitCommand'];
                command.period = 5000;
                command.retries = 3;

                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                const { assertionId } = await this.operationIdService.getCachedOperationIdData(
                    operationId,
                );
                await this.operationIdService.cacheOperationIdData(operationId, {
                    assertionId,
                    assertion: message.data.assertion,
                });
                command.name = 'handleStoreRequestCommand';
                command.sequence = [];

                break;
            default:
                throw Error('unknown messageType');
        }

        await this.commandExecutor.add(command);
    }
}

module.exports = PublishController;
