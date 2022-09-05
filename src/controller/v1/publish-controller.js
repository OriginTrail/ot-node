import BaseController from './base-controller.js';
import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
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

    async handleHttpApiPublishRequest(req, res) {
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
                    this.operationService.getOperationStatus().IN_PROGRESS,
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

    async handleNetworkStoreRequest(message, remotePeerId) {
        const { operationId, keywordUuid, messageType } = message.header;
        const { publishType, assertionId, blockchain, contract } = message.data;
        let commandData = {
            remotePeerId,
            operationId,
            keywordUuid,
            publishType,
            assertionId,
            blockchain,
            contract,
        };
        if (publishType === PUBLISH_TYPES.ASSET || PUBLISH_TYPES.INDEX) {
            commandData = { ...commandData, tokenId: message.data.tokenId };
        }
        const command = {
            sequence: [],
            delay: 0,
            data: commandData,
            transactional: false,
        };
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                command.name = 'handleStoreInitCommand';
                command.period = 5000;
                command.retries = 3;

                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                // eslint-disable-next-line no-case-declarations
                const { assertionId: cachedAssertionId } =
                    await this.operationIdService.getCachedOperationIdData(operationId);
                await this.operationIdService.cacheOperationIdData(operationId, {
                    assertionId: cachedAssertionId,
                    assertion: message.data.assertion,
                });
                command.name = 'handleStoreRequestCommand';
                command.data.keyword = message.data.keyword;

                break;
            default:
                throw Error('unknown message type');
        }

        await this.commandExecutor.add(command);
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
