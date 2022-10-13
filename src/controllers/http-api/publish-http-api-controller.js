import BaseController from './base-http-api-controller.js';
import {
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    PUBLISH_TYPES,
} from '../../constants/constants.js';

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async handlePublishRequest(req, res) {
        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_START,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_INIT_START,
        );

        this.returnResponse(res, 202, {
            operationId,
        });

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_INIT_END,
        );

        const { assertion } = req.body;
        try {
            await Promise.all([
                this.repositoryModuleManager.createOperationRecord(
                    this.operationService.getOperationName(),
                    operationId,
                    OPERATION_STATUS.IN_PROGRESS,
                ),
                this.operationIdService.cacheOperationIdData(operationId, { assertion }),
            ]);

            this.logReceivedAssertionMessage(req.body);

            const commandData = {
                ...req.body,
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

    logReceivedAssertionMessage(requestBody) {
        const { publishType, assertionId, blockchain, contract } = requestBody;
        let receivedAssertionMessage = `Received ${publishType} with assertion id: ${assertionId}, blockchain: ${blockchain}, hub contract: ${contract}`;
        switch (publishType) {
            case PUBLISH_TYPES.ASSERTION:
                break;
            case PUBLISH_TYPES.ASSET:
                receivedAssertionMessage += `, token id: ${requestBody.tokenId}`;
                break;
            case PUBLISH_TYPES.INDEX:
                receivedAssertionMessage += `, token id: ${requestBody.tokenId}, keywords: ${requestBody.keywords}`;
                break;
            default:
                throw Error(`Unknown publish type ${publishType}`);
        }
        this.logger.info(receivedAssertionMessage);
    }
}

export default PublishController;
