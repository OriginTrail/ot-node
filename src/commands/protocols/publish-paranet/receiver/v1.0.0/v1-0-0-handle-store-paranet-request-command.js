import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
} from '../../../../../constants/constants.js';

class HandleParanetStoreRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.validationService = ctx.validationService;
        this.operationService = ctx.publishParanetService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.PUBLISH_PARANET.PUBLISH_PARANET_LOCAL_STORE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const {
            blockchain,
            // keyword,
            // contract,
            // tokenId,
            operationId,
            publicAssertionId,
            // privateAssertioId,
        } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_PARANET.VALIDATING_PUBLISH_PARANET_ASSERTION_REMOTE_START,
        );
        // const assertionIds = await this.blockchainModuleManager.getAssertionIds(
        //     blockchain,
        //     contract,
        //     tokenId,
        // );

        const constCachedData = await this.operationIdService.getCachedOperationIdData(operationId);

        await this.validationService.validateAssertion(
            publicAssertionId,
            blockchain,
            constCachedData.assertions.public.assertion,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_PARANET.VALIDATING_PUBLISH_PARANET_ASSERTION_REMOTE_END,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_PARANET.PUBLISH_PARANET_LOCAL_STORE_START,
        );

        // TODO: Validate assertion is part of paranet

        // TODO: this to paranet repo
        // await this.tripleStoreService.localStoreAsset(
        //     TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
        //     publicAssertionId,
        //     assertion,
        //     blockchain,
        //     contract,
        //     tokenId,
        //     keyword,
        // );

        // await this.tripleStoreService.localStoreAsset(
        //     TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
        //     privateAssertioId,
        //     assertion,
        //     blockchain,
        //     contract,
        //     tokenId,
        //     keyword,
        // );

        // Change thi to be paranet_synced_table
        // await this.repositoryModuleManager.updateServiceAgreementRecord(
        //     blockchain,
        //     contract,
        //     tokenId,
        //     agreementId,
        //     agreementData.startTime,
        //     agreementData.epochsNumber,
        //     agreementData.epochLength,
        //     agreementData.scoreFunctionId,
        //     agreementData.proofWindowOffsetPerc,
        //     hashFunctionId,
        //     keyword,
        //     assertionId,
        //     stateIndex,
        //     SERVICE_AGREEMENT_SOURCES.NODE,
        // );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_PARANET.PUBLISH_PARANET_LOCAL_STORE_END,
        );

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default handleParanetStoreRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleParanetStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleParanetStoreRequestCommand;
