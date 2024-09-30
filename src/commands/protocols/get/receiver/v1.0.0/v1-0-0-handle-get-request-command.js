import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    GET_STATES,
    TRIPLE_STORE_REPOSITORIES,
    PENDING_STORAGE_REPOSITORIES,
} from '../../../../../constants/constants.js';

class HandleGetRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.paranetService = ctx.paranetService;

        this.errorType = ERROR_TYPE.GET.GET_REQUEST_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const {
            operationId,
            blockchain,
            contract,
            tokenId,
            assertionId,
            state,
            paranetUAL,
            paranetId,
            remotePeerId,
        } = commandData;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.GET.GET_REMOTE_START,
        );

        let nquads;

        if (paranetUAL) {
            const paranetCuratedNodes = await this.blockchainModuleManager.getParanetCuratedNodes(
                blockchain,
                paranetId,
            );
            const paranetCuratedPeerIds = paranetCuratedNodes.map((node) =>
                this.blockchainModuleManager.convertHexToAscii(blockchain, node.nodeId),
            );

            if (!paranetCuratedPeerIds.includes(remotePeerId)) {
                return {
                    messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                    messageData: {
                        errorMessage: `Remote peer ${remotePeerId} is not a part of the Paranet (${paranetId}) with UAL: ${paranetUAL}`,
                    },
                };
            }

            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
            const syncedAssetRecord =
                await this.repositoryModuleManager.getParanetSyncedAssetRecordByUAL(ual);

            const paranetRepository = this.paranetService.getParanetRepositoryName(paranetUAL);
            nquads = await this.tripleStoreService.getAssertion(
                paranetRepository,
                syncedAssetRecord.publicAssertionId,
            );

            let privateNquads;
            if (syncedAssetRecord.privateAssertionId) {
                privateNquads = await this.tripleStoreService.getAssertion(
                    paranetRepository,
                    syncedAssetRecord.privateAssertionId,
                );
            }

            if (nquads?.length) {
                const response = {
                    messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                    messageData: { nquads, syncedAssetRecord },
                };

                if (privateNquads?.length) {
                    response.messageData.privateNquads = privateNquads;
                }

                return response;
            }

            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                messageData: {
                    errorMessage: `Unable to find assertion ${assertionId} for Paranet ${paranetId} with UAL: ${paranetUAL}`,
                },
            };
        }

        if (
            !nquads?.length &&
            state !== GET_STATES.FINALIZED &&
            blockchain != null &&
            contract != null &&
            tokenId != null
        ) {
            const cachedAssertion = await this.pendingStorageService.getCachedAssertion(
                PENDING_STORAGE_REPOSITORIES.PUBLIC,
                blockchain,
                contract,
                tokenId,
                assertionId,
                operationId,
            );
            if (cachedAssertion?.public?.assertion?.length) {
                nquads = cachedAssertion.public.assertion;
            }
        }

        if (!nquads?.length) {
            for (const repository of [
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
            ]) {
                // eslint-disable-next-line no-await-in-loop
                nquads = await this.tripleStoreService.getAssertion(repository, assertionId);
                if (nquads.length) {
                    break;
                }
            }
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.GET.GET_REMOTE_END,
        );

        return nquads.length
            ? { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: { nquads } }
            : {
                  messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                  messageData: { errorMessage: `Unable to find assertion ${assertionId}` },
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
