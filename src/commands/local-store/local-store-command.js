import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    LOCAL_STORE_TYPES,
    OPERATION_REQUEST_STATUS,
    NETWORK_MESSAGE_TYPES,
    TRIPLE_STORE_REPOSITORIES,
} from '../../constants/constants.js';
import Command from '../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;
        this.paranetService = ctx.paranetService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.operationIdService = ctx.operationIdService;
        this.operationService = ctx.publishService;
        this.dataService = ctx.dataService;
        this.ualService = ctx.ualService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.signatureService = ctx.signatureService;

        this.errorType = ERROR_TYPE.LOCAL_STORE.LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const {
            operationId,
            blockchain,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
            paranetId,
            datasetRoot,
            isOperationV0,
            contract,
            tokenId,
            minimumNumberOfNodeReplications,
        } = command.data;

        try {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_START,
            );

            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_GET_CACHED_OPERATION_ID_DATA_START,
                operationId,
                blockchain,
            );
            const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);
            this.operationIdService.emitChangeEvent(
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_GET_CACHED_OPERATION_ID_DATA_END,
                operationId,
                blockchain,
            );

            if (storeType === LOCAL_STORE_TYPES.TRIPLE) {
                const storePromises = [];

                if (isOperationV0) {
                    const assertions = [cachedData.public, cachedData.private];

                    for (const data of assertions) {
                        if (data?.assertion && data?.assertionId) {
                            const knowledgeAssetsCount = this.dataService.countDistinctSubjects(
                                data.assertion,
                            );
                            const knowledgeAssetsUALs = [];
                            const knowledgeAssetStates = [];
                            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

                            for (let i = 0; i < knowledgeAssetsCount; i += 1) {
                                knowledgeAssetsUALs.push(`${ual}/${i + 1}`);
                                knowledgeAssetStates.push(0);
                            }

                            storePromises.push(
                                this.tripleStoreService.insertKnowledgeCollection(
                                    TRIPLE_STORE_REPOSITORIES.DKG,
                                    ual,
                                    knowledgeAssetsUALs,
                                    knowledgeAssetStates,
                                    data.assertion,
                                ),
                            );
                        }
                    }
                }

                await Promise.all(storePromises);
            } else if (storeType === LOCAL_STORE_TYPES.TRIPLE_PARANET) {
                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_GET_PARANET_METADATA_START,
                    operationId,
                    blockchain,
                );
                const paranetMetadata = await this.blockchainModuleManager.getParanetMetadata(
                    blockchain,
                    paranetId,
                );
                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_GET_PARANET_METADATA_END,
                    operationId,
                    blockchain,
                );

                const paranetUAL = this.ualService.deriveUAL(
                    blockchain,
                    paranetMetadata.paranetKAStorageContract,
                    paranetMetadata.paranetKATokenId,
                );
                const paranetRepository = this.paranetService.getParanetRepositoryName(paranetUAL);

                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INITIALIZE_PARANET_REPOSITORY_START,
                    operationId,
                    blockchain,
                );
                await this.tripleStoreModuleManager.initializeParanetRepository(paranetRepository);
                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INITIALIZE_PARANET_REPOSITORY_END,
                    operationId,
                    blockchain,
                );

                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INITIALIZE_PARANET_RECORD_START,
                    operationId,
                    blockchain,
                );
                await this.paranetService.initializeParanetRecord(blockchain, paranetId);
                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INITIALIZE_PARANET_RECORD_END,
                    operationId,
                    blockchain,
                );

                if (isOperationV0 && cachedData && cachedData.datasetRoot) {
                    // await this.tripleStoreService.localStoreAsset(
                    //     paranetRepository,
                    //     cachedData.public.assertionId,
                    //     cachedData.public.assertion,
                    //     blockchain,
                    //     contract,
                    //     tokenId,
                    //     keyword,
                    //     LOCAL_INSERT_FOR_CURATED_PARANET_MAX_ATTEMPTS,
                    //     LOCAL_INSERT_FOR_CURATED_PARANET_RETRY_DELAY,
                    // );
                }
                if (isOperationV0 && cachedData && cachedData.datasetRoot) {
                    // await this.tripleStoreService.localStoreAsset(
                    //     paranetRepository,
                    //     cachedData.private.assertionId,
                    //     cachedData.private.assertion,
                    //     blockchain,
                    //     contract,
                    //     tokenId,
                    //     keyword,
                    //     LOCAL_INSERT_FOR_CURATED_PARANET_MAX_ATTEMPTS,
                    //     LOCAL_INSERT_FOR_CURATED_PARANET_RETRY_DELAY,
                    // );
                }

                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INCREMENT_PARANET_KA_COUNT_START,
                    operationId,
                    blockchain,
                );
                await this.repositoryModuleManager.incrementParanetKaCount(paranetId, blockchain);
                this.operationIdService.emitChangeEvent(
                    OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_INCREMENT_PARANET_KA_COUNT_END,
                    operationId,
                    blockchain,
                );
                // await this.repositoryModuleManager.createParanetSyncedAssetRecord(
                //     blockchain,
                //     this.ualService.deriveUAL(blockchain, contract, tokenId),
                //     paranetUAL,
                //     cachedData.public.datasetRoot,
                //     cachedData.private?.assertionId,
                //     cachedData.sender,
                //     cachedData.txHash,
                //     PARANET_SYNC_SOURCES.LOCAL_STORE,
                // );
            } else {
                //     await this.pendingStorageService.cacheAssertion(
                //         PENDING_STORAGE_REPOSITORIES.PRIVATE,
                //         blockchain,
                //         contract,
                //         tokenId,
                //         cachedData.public.datasetRoot,
                //         {
                //             ...cachedData,
                //             keyword,
                //         },
                //         operationId,
                //     );
                //     const updateCommitWindowDuration =
                //         await this.blockchainModuleManager.getUpdateCommitWindowDuration(blockchain);
                //     await this.commandExecutor.add({
                //         name: 'deletePendingStateCommand',
                //         sequence: [],
                //         delay: (updateCommitWindowDuration + 60) * 1000,
                //         data: {
                //             ...command.data,
                //             datasetRoot: cachedData.public.assertionId,
                //         },
                //         transactional: false,
                //     });
            }

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_END,
            );

            const identityId = await this.blockchainModuleManager.getIdentityId(blockchain);
            const { signer, v, r, s, vs } = await this.signatureService.signMessage(
                blockchain,
                datasetRoot,
            );

            await this.signatureService.addSignatureToStorage(
                operationId,
                identityId,
                signer,
                v,
                r,
                s,
                vs,
            );

            const batchSize = await this.operationService.getBatchSize(blockchain);
            const minAckResponses = await this.operationService.getMinAckResponses(
                blockchain,
                minimumNumberOfNodeReplications,
            );

            const updatedData = {
                ...command.data,
                batchSize,
                minAckResponses,
            };

            await this.operationService.processResponse(
                { ...command, data: updatedData },
                OPERATION_REQUEST_STATUS.COMPLETED,
                {
                    messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
                    messageData: { identityId, signer, v, r, s, vs },
                },
                null,
            );
        } catch (e) {
            await this.handleError(operationId, blockchain, e.message, this.errorType, true);
            return Command.empty();
        }

        return Command.empty();
    }

    /**
     * Builds default localStoreCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localStoreCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LocalStoreCommand;
