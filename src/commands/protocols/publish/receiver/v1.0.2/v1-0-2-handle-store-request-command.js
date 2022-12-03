import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    AGREEMENT_STATUS,
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

        await this.operationService.localStoreAsset(
            assertionId,
            blockchain,
            contract,
            tokenId,
            operationId,
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

        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        const assetExists = await this.tripleStoreModuleManager.assetExists(
            ual,
            blockchain,
            contract,
            tokenId,
        );

        if (!assetExists) {
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
