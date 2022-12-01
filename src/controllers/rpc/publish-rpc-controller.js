import BaseController from './base-rpc-controller.js';
import { NETWORK_MESSAGE_TYPES, PUBLISH_TYPES } from '../../constants/constants.js';

class PublishController extends BaseController {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.commandExecutor = ctx.commandExecutor;
        this.operationIdService = ctx.operationIdService;
    }

    async v1_0_0HandleRequest(message, remotePeerId, protocol) {
        const { operationId, keywordUuid, messageType } = message.header;
        const { assertionId, ual } = message.data;
        const command = {
            sequence: [],
            delay: 0,
            data: {
                remotePeerId,
                operationId,
                keywordUuid,
                assertionId,
                ual,
                protocol,
            },
            transactional: false,
        };

        const [handleInitCommand, handleRequestCommand] = this.getCommandSequence(protocol);
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                command.name = handleInitCommand;
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
                command.name = handleRequestCommand;
                command.data.keyword = message.data.keyword;
                break;
            default:
                throw Error('unknown messageType');
        }
        await this.commandExecutor.add(command);
    }

    async v1_0_1HandleRequest(message, remotePeerId, protocol) {
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
            protocol,
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
        const [handleInitCommand, handleRequestCommand] = this.getCommandSequence(protocol);
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                command.name = handleInitCommand;
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
                command.name = handleRequestCommand;
                command.data.keyword = message.data.keyword;

                break;
            default:
                throw Error('unknown message type');
        }

        await this.commandExecutor.add(command);
    }

    async v1_0_2HandleRequest(message, remotePeerId, protocol) {
        const { operationId, keywordUuid, messageType } = message.header;

        const command = { sequence: [], delay: 0, transactional: false, data: {} };
        let dataSource;
        const [handleInitCommand, handleRequestCommand] = this.getCommandSequence(protocol);
        switch (messageType) {
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_INIT:
                dataSource = message.data;
                command.name = handleInitCommand;
                command.period = 5000;
                command.retries = 3;

                break;
            case NETWORK_MESSAGE_TYPES.REQUESTS.PROTOCOL_REQUEST:
                // eslint-disable-next-line no-case-declarations
                dataSource = await this.operationIdService.getCachedOperationIdData(operationId);
                await this.operationIdService.cacheOperationIdData(operationId, {
                    assertion: message.data.assertion,
                });
                command.name = handleRequestCommand;
                command.data.keyword = message.data.keyword;

                break;
            default:
                throw Error('unknown message type');
        }

        command.data = {
            remotePeerId,
            operationId,
            keywordUuid,
            protocol,
            assertionId: dataSource.assertionId,
            blockchain: dataSource.blockchain,
            contract: dataSource.contract,
            tokenId: dataSource.tokenId,
            keyword: dataSource.keyword,
            hashFunctionId: dataSource.hashFunctionId,
        };

        await this.commandExecutor.add(command);
    }
}

export default PublishController;
