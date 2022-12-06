import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    AGREEMENT_STATUS,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../../../constants/constants.js';

class HandleStoreRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const {
            blockchain,
            keyword,
            hashFunctionId,
            contract,
            tokenId,
            operationId,
            assertionId,
            agreementId,
            agreementData,
        } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_START,
        );
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);
        await this.operationService.validateAssertion(assertionId, blockchain, assertion);

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_ASSERTION_REMOTE_END,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );

        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        const assetExists = await this.tripleStoreModuleManager.assetExists(
            TRIPLE_STORE_REPOSITORIES.CURRENT,
            ual,
            blockchain,
            contract,
            tokenId,
        );

        const agreementEndTime =
            Number(agreementData.startTime) +
            Number(agreementData.epochsNumber) * Number(agreementData.epochLength);

        await this.operationService.localStoreAsset(
            assertionId,
            blockchain,
            contract,
            tokenId,
            operationId,
            agreementData.startTime,
            agreementEndTime,
            keyword,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_END,
        );

        await this.repositoryModuleManager.updateOperationAgreementStatus(
            operationId,
            agreementId,
            AGREEMENT_STATUS.ACTIVE,
        );

        if (!assetExists) {
            this.logger.trace(
                `Asset with ${ual} not previously present in triple store. Scheduling epoch check command.`,
            );
            await this.commandExecutor.add({
                name: 'epochCheckCommand',
                sequence: [],
                delay: 0,
                data: {
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                    epoch: 0,
                    hashFunctionId,
                    operationId,
                    agreementId,
                    agreementData,
                },
                transactional: false,
            });
        } else {
            this.logger.trace(
                `Asset with ${ual} previously present in triple store. Not scheduling epoch check command.`,
            );
        }

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default handleStoreRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_2HandleStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreRequestCommand;
