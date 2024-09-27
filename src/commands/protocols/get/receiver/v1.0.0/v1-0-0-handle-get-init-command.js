import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import {
    ERROR_TYPE,
    GET_STATES,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    PENDING_STORAGE_REPOSITORIES,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../../../constants/constants.js';

class HandleGetInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.operationService = ctx.getService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.ualService = ctx.ualService;

        this.errorType = ERROR_TYPE.GET.GET_INIT_REMOTE_ERROR;
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
            OPERATION_ID_STATUS.GET.ASSERTION_EXISTS_LOCAL_START,
        );

        this.logger.trace(
            `Checking if assertion ${assertionId} exists for state ${state}, on blockchain: ${blockchain}, contract: ${contract}, and tokenId: ${tokenId}`,
        );

        let assertionExists = false;

        if (paranetUAL) {
            const paranetCuratedNodes = await this.blockchainModuleManager.getParanetCuratedNodes(
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
            assertionExists = await this.tripleStoreService.assertionExists(
                paranetRepository,
                syncedAssetRecord.publicAssertionId,
            );

            if (syncedAssetRecord.privateAssertionId) {
                assertionExists =
                    assertionExists &&
                    (await this.tripleStoreService.assertionExists(
                        paranetRepository,
                        syncedAssetRecord.privateAssertionId,
                    ));
            }

            if (!assertionExists) {
                return {
                    messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
                    messageData: {
                        errorMessage: `Assertion ${assertionId} not found for Paranet (${paranetId}) with UAL: ${paranetUAL}`,
                    },
                };
            }
        }

        if (
            !assertionExists &&
            state !== GET_STATES.FINALIZED &&
            blockchain != null &&
            contract != null &&
            tokenId != null
        ) {
            assertionExists = await this.pendingStorageService.assetHasPendingState(
                PENDING_STORAGE_REPOSITORIES.PUBLIC,
                blockchain,
                contract,
                tokenId,
                assertionId,
            );
        }

        if (!assertionExists) {
            for (const repository of [
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
            ]) {
                // eslint-disable-next-line no-await-in-loop
                assertionExists = await this.tripleStoreService.assertionExists(
                    repository,
                    assertionId,
                );
                if (assertionExists) {
                    break;
                }
            }
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.GET.ASSERTION_EXISTS_LOCAL_END,
        );

        if (assertionExists) {
            return {
                messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                messageData: {},
            };
        }
        return {
            messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
            messageData: { errorMessage: `Assertion ${assertionId} not found` },
        };
    }

    /**
     * Builds default handleGetInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleGetInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleGetInitCommand;
