import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    LOCAL_STORE_TYPES,
    PENDING_STORAGE_REPOSITORIES,
    TRIPLE_STORE_REPOSITORIES,
    LOCAL_INSERT_FOR_CURATED_PARANET_MAX_ATTEMPTS,
    LOCAL_INSERT_FOR_CURATED_PARANET_RETRY_DELAY,
    PARANET_SYNC_SOURCES,
} from '../../constants/constants.js';
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
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;

        this.errorType = ERROR_TYPE.LOCAL_STORE.LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const {
            operationId,
            blockchain,
            contract,
            tokenId,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
            paranetId,
        } = command.data;

        try {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_START,
            );

            const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);

            const keyword = await this.ualService.calculateLocationKeyword(
                blockchain,
                contract,
                tokenId,
            );

            if (storeType === LOCAL_STORE_TYPES.TRIPLE) {
                const storePromises = [];
                if (cachedData.public.assertion && cachedData.public.assertionId) {
                    storePromises.push(
                        this.tripleStoreService.localStoreAsset(
                            TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                            cachedData.public.assertionId,
                            cachedData.public.assertion,
                            blockchain,
                            contract,
                            tokenId,
                            keyword,
                        ),
                    );
                }
                if (cachedData.private.assertion && cachedData.private.assertionId) {
                    storePromises.push(
                        this.tripleStoreService.localStoreAsset(
                            TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                            cachedData.private.assertionId,
                            cachedData.private.assertion,
                            blockchain,
                            contract,
                            tokenId,
                            keyword,
                        ),
                    );
                }
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

                if (cachedData.public.assertion && cachedData.public.assertionId) {
                    // eslint-disable-next-line no-await-in-loop
                    await this.tripleStoreService.localStoreAsset(
                        paranetRepository,
                        cachedData.public.assertionId,
                        cachedData.public.assertion,
                        blockchain,
                        contract,
                        tokenId,
                        keyword,
                        LOCAL_INSERT_FOR_CURATED_PARANET_MAX_ATTEMPTS,
                        LOCAL_INSERT_FOR_CURATED_PARANET_RETRY_DELAY,
                    );
                }
                if (cachedData.private?.assertion && cachedData.private?.assertionId) {
                    // eslint-disable-next-line no-await-in-loop
                    await this.tripleStoreService.localStoreAsset(
                        paranetRepository,
                        cachedData.private.assertionId,
                        cachedData.private.assertion,
                        blockchain,
                        contract,
                        tokenId,
                        keyword,
                        LOCAL_INSERT_FOR_CURATED_PARANET_MAX_ATTEMPTS,
                        LOCAL_INSERT_FOR_CURATED_PARANET_RETRY_DELAY,
                    );
                }

                await this.repositoryModuleManager.incrementParanetKaCount(paranetId, blockchain);
                await this.repositoryModuleManager.createParanetSyncedAssetRecord(
                    blockchain,
                    this.ualService.deriveUAL(blockchain, contract, tokenId),
                    paranetUAL,
                    cachedData.public.assertionId,
                    cachedData.private?.assertionId,
                    cachedData.sender,
                    cachedData.txHash,
                    PARANET_SYNC_SOURCES.LOCAL_STORE,
                );
            } else {
                await this.pendingStorageService.cacheAssertion(
                    PENDING_STORAGE_REPOSITORIES.PRIVATE,
                    blockchain,
                    contract,
                    tokenId,
                    cachedData.public.assertionId,
                    {
                        ...cachedData,
                        keyword,
                    },
                    operationId,
                );

                const updateCommitWindowDuration =
                    await this.blockchainModuleManager.getUpdateCommitWindowDuration(blockchain);
                await this.commandExecutor.add({
                    name: 'deletePendingStateCommand',
                    sequence: [],
                    delay: (updateCommitWindowDuration + 60) * 1000,
                    data: {
                        ...command.data,
                        assertionId: cachedData.public.assertionId,
                    },
                    transactional: false,
                });
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
