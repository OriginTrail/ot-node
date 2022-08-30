const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const {
    NETWORK_MESSAGE_TYPES,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    PUBLISH_TYPES,
} = require('../../../../constants/constants');

class HandlePublishInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { publishType, operationId, assertionId } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_START,
        );

        if (publishType === PUBLISH_TYPES.ASSET) {
            const { blockchain, contract, tokenId } = commandData;
            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
            this.logger.info(`Validating assertion with ual: ${ual}`);

            const blockchainAssertionId = await this.operationService.getAssertion(
                blockchain,
                contract,
                tokenId,
            );
            if (blockchainAssertionId !== assertionId) {
                throw Error(
                    `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${assertionId}`,
                );
            }
        }

        await Promise.all([
            this.operationIdService.cacheOperationIdData(operationId, { assertionId }),
            this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_END,
            ),
        ]);

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async retryFinished(command) {
        const { operationId } = command.data;
        this.handleError(
            `Retry count for command: ${command.name} reached! Unable to validate data for operation id: ${operationId}`,
            command,
        );
    }

    /**
     * Builds default handlePublishInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handlePublishInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandlePublishInitCommand;
