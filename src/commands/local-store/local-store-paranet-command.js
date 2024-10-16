import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../constants/constants.js';
import Command from '../command.js';

class LocalStoreParanetCommand extends Command {
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
        this.paranetService = ctx.paranetService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.LOCAL_STORE_PARANET.LOCAL_STORE_PARANET_ERROR;
    }

    async execute(command) {
        const { operationId, blockchain, contract, tokenId } = command.data;

        try {
            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.LOCAL_STORE_PARANET.LOCAL_STORE_PARANET_START,
            );
            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

            const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);

            const keyword = await this.ualService.calculateLocationKeyword(
                blockchain,
                contract,
                tokenId,
            );

            const { paranetUAL, sender, txHash } = cachedData;

            const paranetRepositoryName = this.paranetService.getParanetRepositoryName(paranetUAL);

            await this.tripleStoreService.localStoreAsset(
                paranetRepositoryName,
                cachedData.cachedAssertions.public.assertionId,
                cachedData.cachedAssertions.public.assertion,
                blockchain,
                contract,
                tokenId,
                keyword,
            );
            if (cachedData.cachedAssertions.private.assertion) {
                await this.tripleStoreService.localStoreAsset(
                    paranetRepositoryName,
                    cachedData.cachedAssertions.private.assertionId,
                    cachedData.cachedAssertions.private.assertion,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                );
            }
            await this.repositoryModuleManager.createParanetSyncedAssetRecord(
                blockchain,
                ual,
                paranetUAL,
                cachedData.cachedAssertions.public.assertionId,
                cachedData.cachedAssertions.private.assertionId,
                sender,
                txHash,
            );

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.LOCAL_STORE_PARANET.LOCAL_STORE_PARANET_END,
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
     * Builds default localStoreParanetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localStoreParanetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LocalStoreParanetCommand;
