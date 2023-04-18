import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    LOCAL_STORE_TYPES,
    PENDING_STORAGE_REPOSITORIES,
    TRIPLE_STORE_REPOSITORIES,
    CONTENT_ASSET_HASH_FUNCTION_ID,
} from '../../constants/constants.js';
import Command from '../command.js';

class LocalStoreCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.operationIdService = ctx.operationIdService;
        this.dataService = ctx.dataService;
        this.ualService = ctx.ualService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.commandExecutor = ctx.commandExecutor;

        this.errorType = ERROR_TYPE.LOCAL_STORE.LOCAL_STORE_ERROR;
    }

    async execute(command) {
        const {
            operationId,
            blockchain,
            contract,
            tokenId,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
        } = command.data;

        try {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_START,
            );

            const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);

            const keyword = await this.ualService.calculateLocationKeyword(
                blockchain,
                contract,
                tokenId,
            );
            const agreementId = await this.serviceAgreementService.generateId(
                blockchain,
                contract,
                tokenId,
                keyword,
                CONTENT_ASSET_HASH_FUNCTION_ID,
            );
            const agreementData = await this.blockchainModuleManager.getAgreementData(
                blockchain,
                agreementId,
            );

            const agreementEndTime =
                Number(agreementData.startTime) +
                Number(agreementData.epochsNumber) * Number(agreementData.epochLength);

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
                            Number(agreementData.startTime),
                            agreementEndTime,
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
                            Number(agreementData.startTime),
                            agreementEndTime,
                            keyword,
                        ),
                    );
                }
                await Promise.all(storePromises);
            } else {
                await this.pendingStorageService.cacheAssertion(
                    PENDING_STORAGE_REPOSITORIES.PRIVATE,
                    blockchain,
                    contract,
                    tokenId,
                    {
                        ...cachedData,
                        agreementStartTime: Number(agreementData.startTime),
                        agreementEndTime,
                        keyword,
                    },
                    operationId,
                );

                const updateCommitWindowDuration =
                    await this.blockchainModuleManager.getUpdateCommitWindowDuration(blockchain);
                await this.commandExecutor.add({
                    name: 'deletePendingStateCommand',
                    sequence: [],
                    delay: updateCommitWindowDuration * 1000,
                    data: { ...command.data, repository: PENDING_STORAGE_REPOSITORIES.PRIVATE },
                    transactional: false,
                });
            }

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.LOCAL_STORE.LOCAL_STORE_END,
            );

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.COMPLETED,
            );
        } catch (e) {
            await this.handleError(operationId, e.message, this.errorType, true);
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
