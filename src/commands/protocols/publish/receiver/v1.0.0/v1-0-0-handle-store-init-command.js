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
        this.repositoryModuleManager = ctx.repositoryModuleManager;

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

        this.logger.trace(`Validating neighborhood for ual: ${ual}`);
        if (!(await this.validateNeighborhood(blockchain, keyword, hashFunctionId, ual))) {
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: { errorMessage: 'Invalid neighbourhood' },
            };
        }

        this.logger.trace(`Validating assertion with ual: ${ual}`);
        await this.validateAssertionId(blockchain, contract, tokenId, assertionId, ual);
        this.logger.trace(`Validating bid for asset with ual: ${ual}`);
        const { errorMessage, agreementId, agreementData } = await this.validateBid(
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            blockchain,
            assertionId,
            operationId,
        );

        if (errorMessage) {
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: { errorMessage },
            };
        }

        await Promise.all([
            this.operationIdService.cacheOperationIdData(operationId, {
                assertionId,
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
                agreementId,
                agreementData,
            }),

            this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_END,
            ),
        ]);

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async validateNeighborhood(blockchain, keyword, hashFunctionId, ual) {
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
        const blockchainAssertionId = await this.publishService.getLatestAssertionId(
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

    async validateBid(
        contract,
        tokenId,
        keyword,
        hashFunctionId,
        blockchain,
        assertionId,
        operationId,
    ) {
        const geAgreementData = async () => {
            const agreementId = await this.serviceAgreementService.generateId(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashFunctionId,
            );
            this.logger.info(
                `Calculated agreement id: ${agreementId} for contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, hash function id: ${hashFunctionId}, operationId: ${operationId}`,
            );

            return {
                agreementId,
                agreementData: await this.blockchainModuleManager.getAgreementData(
                    blockchain,
                    agreementId,
                ),
            };
        };

        const getAsk = async () => {
            const peerRecord = await this.repositoryModuleManager.getPeerRecord(
                this.networkModuleManager.getPeerId().toB58String(),
                blockchain,
            );

            const ask = this.blockchainModuleManager.convertToWei(blockchain, peerRecord.ask);

            return this.blockchainModuleManager.toBigNumber(blockchain, ask);
        };

        const [{ agreementId, agreementData }, blockchainAssertionSize, r0, ask] =
            await Promise.all([
                geAgreementData(),
                this.blockchainModuleManager.getAssertionSize(blockchain, assertionId),
                this.blockchainModuleManager.getR0(blockchain),
                getAsk(),
            ]);

        const divisor = this.blockchainModuleManager
            .toBigNumber(blockchain, r0)
            .mul(agreementData.epochsNumber)
            .mul(blockchainAssertionSize);

        const serviceAgreementBid = this.blockchainModuleManager
            .toBigNumber(blockchain, agreementData.tokenAmount)
            .mul(1024)
            .div(divisor)
            .add(1); // add 1 wei because of the precision loss

        const bidAskLog = `Service agreement bid: ${serviceAgreementBid}, ask: ${ask}, operationId: ${operationId}`;
        this.logger.trace(bidAskLog);

        return {
            errorMessage: ask.lte(serviceAgreementBid) ? null : bidAskLog,
            agreementId,
            agreementData,
        };
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
            name: 'v1_0_0HandleStoreInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreInitCommand;
