import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import {
    NETWORK_MESSAGE_TYPES,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class HandleStoreInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.publishService = ctx.publishService;
        this.ualService = ctx.ualService;
        this.shardingTableService = ctx.shardingTableService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { operationId, assertionId, blockchain, contract, tokenId, keyword, hashFunctionId } =
            commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_START,
        );
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        if (!(await this.validateNeighborhood(blockchain, keyword, hashFunctionId, ual))) {
            return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK, messageData: {} };
        }

        await this.validateAssertionId(blockchain, contract, tokenId, assertionId, ual);
        if (
            !(await this.validateServiceAgreement(
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                blockchain,
                ual,
            ))
        ) {
            return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK, messageData: {} };
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

    async validateNeighborhood(blockchain, keyword, hashFunctionId, ual) {
        this.logger.trace(`Validating neighborhood for ual: ${ual}`);
        const closestNodes = await this.shardingTableService.findNeighbourhood(
            blockchain,
            keyword,
            await this.blockchainModuleManager.getR2(blockchain),
            hashFunctionId,
            false,
        );
        for (const { peer_id } of closestNodes) {
            if (peer_id === this.networkModuleManager.getPeerId().toB58String()) {
                return true;
            }
        }
        this.logger.warn(`Invalid neighborhood for ual: ${ual}`);

        return false;
    }

    async validateAssertionId(blockchain, contract, tokenId, assertionId, ual) {
        this.logger.trace(`Validating assertion with ual: ${ual}`);

        const blockchainAssertionId = await this.publishService.getLatestAssertion(
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

    async validateServiceAgreement(contract, tokenId, keyword, hashFunctionId, blockchain, ual) {
        const agreementId = await this.serviceAgreementService.generateId(
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        );
        const tokenAmount = await this.blockchainModuleManager.getAgreementTokenAmount(
            blockchain,
            agreementId,
        );
        if (!tokenAmount) {
            this.logger.warn(`Invalid service agreement for ual: ${ual}`);
            return false;
        }
        return true;
    }

    async retryFinished(command) {
        const { operationId } = command.data;
        this.handleError(
            `Retry count for command: ${command.name} reached! Unable to validate data for operation id: ${operationId}`,
            command,
        );
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_2HandleStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreInitCommand;
