import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    TRIPLE_STORE_REPOSITORIES,
    SERVICE_AGREEMENT_SOURCES,
} from '../../../../../constants/constants.js';

class HandleStoreRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.validationService = ctx.validationService;
        this.operationService = ctx.publishService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { blockchain, keyword, hashFunctionId, contract, tokenId, operationId, assertionId } =
            commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_START,
        );

        const { agreementId, agreementData } = await this.getAgreementData(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            operationId,
        );

        const validationResult = await this.validateReceivedData(
            operationId,
            assertionId,
            blockchain,
            contract,
            tokenId,
        );

        this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_END,
        );

        if (validationResult.messageType === NETWORK_MESSAGE_TYPES.RESPONSES.NACK) {
            return validationResult;
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_PUBLISH_ASSERTION_REMOTE_START,
        );
        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );
        const stateIndex = assertionIds.length - 1;
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);
        await this.validationService.validateAssertion(assertionId, blockchain, assertion);

        // TODO: Thos updateOperationIdStatus update in a row, this should be changed
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.VALIDATING_PUBLISH_ASSERTION_REMOTE_END,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_START,
        );

        await this.tripleStoreService.localStoreAsset(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            assertionId,
            assertion,
            blockchain,
            contract,
            tokenId,
            keyword,
        );

        await this.repositoryModuleManager.updateServiceAgreementRecord(
            blockchain,
            contract,
            tokenId,
            agreementId,
            agreementData.startTime,
            agreementData.epochsNumber,
            agreementData.epochLength,
            agreementData.scoreFunctionId,
            agreementData.proofWindowOffsetPerc,
            hashFunctionId,
            keyword,
            assertionId,
            stateIndex,
            SERVICE_AGREEMENT_SOURCES.NODE,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_END,
        );

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default handleStoreRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreRequestCommand;
