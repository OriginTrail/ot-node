import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    TRIPLES_VISIBILITY,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../../../constants/constants.js';

class HandleGetRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.paranetService = ctx.paranetService;

        this.errorType = ERROR_TYPE.GET.GET_REQUEST_REMOTE_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.GET.GET_REMOTE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.GET.GET_REMOTE_END;
        this.prepareMessageStartEvent = OPERATION_ID_STATUS.GET.GET_REMOTE_PREPARE_MESSAGE_START;
        this.prepareMessageEndEvent = OPERATION_ID_STATUS.GET.GET_REMOTE_PREPARE_MESSAGE_END;
        this.sendMessageResponseStartEvent = OPERATION_ID_STATUS.GET.GET_REMOTE_SEND_MESSAGE_START;
        this.sendMessageResponseEndEvent = OPERATION_ID_STATUS.GET.GET_REMOTE_SEND_MESSAGE_END;
        this.removeCachedSessionStartEvent =
            OPERATION_ID_STATUS.GET.GET_REMOTE_REMOVE_CACHED_SESSION_START;
        this.removeCachedSessionEndEvent =
            OPERATION_ID_STATUS.GET.GET_REMOTE_REMOVE_CACHED_SESSION_END;
    }

    async prepareMessage(commandData) {
        const {
            operationId,
            blockchain,
            contract,
            knowledgeCollectionId,
            knowledgeAssetId,
            ual,
            includeMetadata,
            assertionId,
        } = commandData;

        // if (paranetUAL) {
        //     const paranetNodeAccessPolicy = await this.blockchainModuleManager.getNodesAccessPolicy(
        //         blockchain,
        //         paranetId,
        //     );
        //     if (paranetNodeAccessPolicy === PARANET_ACCESS_POLICY.CURATED) {
        //         const paranetCuratedNodes =
        //             await this.blockchainModuleManager.getParanetCuratedNodes(
        //                 blockchain,
        //                 paranetId,
        //             );
        //         const paranetCuratedPeerIds = paranetCuratedNodes.map((node) =>
        //             this.blockchainModuleManager.convertHexToAscii(blockchain, node.nodeId),
        //         );

        //         if (!paranetCuratedPeerIds.includes(remotePeerId)) {
        //             return {
        //                 messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
        //                 messageData: {
        //                     errorMessage: `Remote peer ${remotePeerId} is not a part of the Paranet (${paranetId}) with UAL: ${paranetUAL}`,
        //                 },
        //             };
        //         }
        //         const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        //         const paranetRepository = this.paranetService.getParanetRepositoryName(paranetUAL);
        //         const syncedAssetRecord =
        //             await this.repositoryModuleManager.getParanetSyncedAssetRecordByUAL(ual);

        //         nquads = await this.tripleStoreService.getAssertion(paranetRepository, assertionId);

        //         let privateNquads;
        //         if (syncedAssetRecord.privateAssertionId) {
        //             privateNquads = await this.tripleStoreService.getAssertion(
        //                 paranetRepository,
        //                 syncedAssetRecord.privateAssertionId,
        //             );
        //         }

        //         if (nquads?.length) {
        //             const response = {
        //                 messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
        //                 messageData: { nquads, syncedAssetRecord },
        //             };

        //             if (privateNquads?.length) {
        //                 response.messageData.privateNquads = privateNquads;
        //             }

        //             return response;
        //         }

        //         return {
        //             messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
        //             messageData: {
        //                 errorMessage: `Unable to find assertion ${assertionId} for Paranet ${paranetId} with UAL: ${paranetUAL}`,
        //             },
        //         };
        //     }
        // }

        const promises = [];
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.GET.GET_REMOTE_GET_ASSERTION_START,
            operationId,
            blockchain,
        );

        let assertionPromise;

        if (assertionId) {
            assertionPromise = this.tripleStoreService
                .getV6Assertion(TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT, assertionId)
                .then((result) => {
                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.GET.GET_REMOTE_GET_ASSERTION_END,
                        operationId,
                        blockchain,
                    );
                    return result;
                });
        } else {
            assertionPromise = this.tripleStoreService
                .getAssertion(
                    blockchain,
                    contract,
                    knowledgeCollectionId,
                    knowledgeAssetId,
                    TRIPLES_VISIBILITY.PUBLIC,
                )
                .then((result) => {
                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.GET.GET_REMOTE_GET_ASSERTION_END,
                        operationId,
                        blockchain,
                    );
                    return result;
                });
        }
        promises.push(assertionPromise);

        if (includeMetadata) {
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.GET.GET_REMOTE_GET_ASSERTION_METADATA_START,
                operationId,
                blockchain,
            );
            const metadataPromise = this.tripleStoreService
                .getAssertionMetadata(blockchain, contract, knowledgeCollectionId, knowledgeAssetId)
                .then((result) => {
                    this.operationIdService.emitChangeEvent(
                        OPERATION_ID_STATUS.GET.GET_REMOTE_GET_ASSERTION_METADATA_END,
                        operationId,
                        blockchain,
                    );
                    return result;
                });
            promises.push(metadataPromise);
        }

        const [assertion, metadata] = await Promise.all(promises);

        const responseData = {
            assertion,
            ...(includeMetadata && metadata && { metadata }),
        };

        if (assertion.length) {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.GET.GET_REMOTE_END,
            );
        }

        return assertion.length
            ? { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: responseData }
            : {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                  messageData: { errorMessage: `Unable to find assertion ${ual}` },
              };
    }

    /**
     * Builds default handleGetRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleGetRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.GET.GET_REQUEST_REMOTE_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleGetRequestCommand;
