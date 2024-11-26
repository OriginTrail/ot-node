import { LOCAL_STORE_TYPES, ERROR_TYPE, OPERATION_ID_STATUS } from '../../constants/constants.js';
import Command from '../command.js';

class PostLocalStoreParanetValidateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationIdService = ctx.operationIdService;
        this.paranetService = ctx.paranetService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.commandExecutor = ctx.commandExecutor;
        this.ualService = ctx.ualService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.VALIDATE_ASSET_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
            paranetId,
        } = command.data;

        const operationId = await this.operationIdService.generateOperationId(
            OPERATION_ID_STATUS.VALIDATE_ASSET_START,
        );
        const assetUal = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.info(
            `[Post Local-Store] Checking if asset: ${assetUal} is part of paranet: ${paranetId}, operation id: ${operationId}.`,
        );

        try {
            if (storeType === LOCAL_STORE_TYPES.TRIPLE_PARANET) {
                const knowledgeAssetId = this.paranetService.constructKnowledgeAssetId(
                    blockchain,
                    contract,
                    tokenId,
                );

                const isKnowledgeAssetRegistered =
                    await this.blockchainModuleManager.isKnowledgeAssetRegistered(
                        paranetId,
                        knowledgeAssetId,
                    );

                if (!isKnowledgeAssetRegistered) {
                    this.logger.info(
                        `[Post Local-Store] Asset: ${assetUal} is NOT part of paranet: ${paranetId}, operation id: ${operationId}. Deleting it from paranet operational table.`,
                    );

                    await this.repositoryModuleManager.deleteParanetSyncedAssetRecord(assetUal);
                }
            }
        } catch (e) {
            await this.handleError(operationId, blockchain, e.message, this.errorType, true);
        }

        return Command.empty();
    }

    /**
     * Builds default PostLocalStoreParanetValidateCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'postLocalStoreParanetValidateCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PostLocalStoreParanetValidateCommand;
