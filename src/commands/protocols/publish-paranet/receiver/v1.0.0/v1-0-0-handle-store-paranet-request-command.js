import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
} from '../../../../../constants/constants.js';

class HandleStoreParanetRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.validationService = ctx.validationService;
        this.operationService = ctx.publishParanetService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;
        this.paranetService = ctx.paranetService;

        this.errorType = ERROR_TYPE.PUBLISH_PARANET.PUBLISH_PARANET_LOCAL_STORE_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const {
            blockchain,
            contract,
            tokenId,
            operationId,
            publicAssertionId,
            privateAssertionId,
        } = commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_PARANET.VALIDATING_PUBLISH_PARANET_ASSERTION_REMOTE_START,
        );

        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        // const assertionIds = await this.blockchainModuleManager.getAssertionIds(
        //     blockchain,
        //     contract,
        //     tokenId,
        // );

        const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);

        const { paranetUAL, sender, txHash } = cachedData;

        const keyword = await this.ualService.calculateLocationKeyword(
            blockchain,
            contract,
            tokenId,
        );

        await this.validationService.validateAssertion(
            publicAssertionId,
            blockchain,
            cachedData.assertions.public.assertion,
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
        const paranetRepositoryName = this.paranetService.getParanetRepositoryName(paranetUAL);

        // TODO: this to paranet repo

        try {
            await this.tripleStoreService.localStoreAsset(
                paranetRepositoryName,
                publicAssertionId,
                cachedData.assertions.public.assertion,
                blockchain,
                contract,
                tokenId,
                keyword,
            );
        } catch (e) {
            await this.tripleStoreService.deleteAssetMetadata(
                paranetRepositoryName,
                blockchain,
                contract,
                tokenId,
            );
            await this.tripleStoreService.deleteAssertion(paranetRepositoryName, publicAssertionId);
            throw e;
        }

        if (cachedData.assertions.private?.assertion) {
            try {
                await this.tripleStoreService.localStoreAsset(
                    paranetRepositoryName,
                    privateAssertionId,
                    cachedData.assertions.private.assertion,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                );
            } catch (e) {
                await this.tripleStoreService.deleteAssetMetadata(
                    paranetRepositoryName,
                    blockchain,
                    contract,
                    tokenId,
                );
                await this.tripleStoreService.deleteAssertion(
                    paranetRepositoryName,
                    privateAssertionId,
                );
                await this.tripleStoreService.deleteAssertion(
                    paranetRepositoryName,
                    publicAssertionId,
                );
                throw e;
            }
        }
        await this.repositoryModuleManager.createParanetSyncedAssetRecord(
            blockchain,
            ual,
            paranetUAL,
            publicAssertionId,
            privateAssertionId,
            sender,
            txHash,
        );

        const paranetId = this.paranetService.getParanetIdFromUAL(paranetUAL);
        await this.repositoryModuleManager.incrementParanetKaCount(paranetId, blockchain);
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH_PARANET.PUBLISH_PARANET_LOCAL_STORE_END,
        );

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default handleStoreParanetRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleStoreParanetRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreParanetRequestCommand;
