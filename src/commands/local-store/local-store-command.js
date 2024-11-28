import { OPERATION_ID_STATUS, ERROR_TYPE, LOCAL_STORE_TYPES } from '../../constants/constants.js';
import Command from '../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;
        this.paranetService = ctx.paranetService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.operationIdService = ctx.operationIdService;
        this.dataService = ctx.dataService;
        this.ualService = ctx.ualService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.commandExecutor = ctx.commandExecutor;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.LOCAL_STORE.LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const {
            operationId,
            blockchain,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
            paranetId,
            datasetRoot
        } = command.data;

        try {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_START,
            );

            const cachedData = await this.pendingStorageService.getCachedDataset(blockchain, datasetRoot);

            if (storeType === LOCAL_STORE_TYPES.TRIPLE) {
                const storePromises = [];
                
                if (cachedData.public.dataset && cachedData.public.datasetRoot) {
                    storePromises.push(
                        this.pendingStorageService.cacheDataset(
                            operationId,
                            cachedData.public.datasetRoot,
                            cachedData.public.dataset,
                        ),
                    );
                }
                // if (cachedData.private?.assertion && cachedData.private?.assertionId) {
                //     storePromises.push(
                //         this.pendingStorageService.cacheDataset(
                //             operationId,
                //             datasetRoot,
                //             dataset,
                //         ),
                //     );
                // }
                await Promise.all(storePromises);
            } else if (storeType === LOCAL_STORE_TYPES.TRIPLE_PARANET) {
                const paranetMetadata = await this.blockchainModuleManager.getParanetMetadata(
                    blockchain,
                    paranetId,
                );
                const paranetUAL = this.ualService.deriveUAL(
                    blockchain,
                    paranetMetadata.paranetKAStorageContract,
                    paranetMetadata.paranetKATokenId,
                );
                const paranetRepository = this.paranetService.getParanetRepositoryName(paranetUAL);

                await this.tripleStoreModuleManager.initializeParanetRepository(paranetRepository);
                await this.paranetService.initializeParanetRecord(blockchain, paranetId);

                if (datasetRoot && cachedData) {
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
                if (datasetRoot && cachedData) {
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

                await this.repositoryModuleManager.incrementParanetKaCount(paranetId, blockchain);
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

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.COMPLETED,
            );
        } catch (e) {
            await this.handleError(operationId, blockchain, e.message, this.errorType, true);
            return Command.empty();
        }

        return this.continueSequence(command.data, command.sequence);
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
