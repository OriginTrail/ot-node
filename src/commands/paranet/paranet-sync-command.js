import Command from '../command.js';
import { ERROR_TYPE, PARANET_SYNC_FREQUENCY_MILLS } from '../../constants/constants.js';

class StartParanetSyncCommands extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;

        this.errorType = ERROR_TYPE.PARANET.PARANET_SYNC_ERROR;
    }

    async execute(command) {
        const { operationId, paranetId } = command.data;

        this.logger.info(
            `Paranet sync: Starting paranet sync command for ${paranetId} with operation id: ${operationId}`,
        );

        // get missed token ids for paranet

        // schedule get commands for each asset

        // store in paranet repository

        return Command.repeat();
    }

    // async syncAsset(tokenId, blockchain, contract) {
    //     const assertionIds = await this.blockchainModuleManager.getLatestAssertionId(
    //         blockchain,
    //         contract,
    //         tokenId,
    //     );
    //
    //     // eslint-disable-next-line for-direction
    //     for (let stateIndex = assertionIds.length - 1; stateIndex < 0; stateIndex -= 1) {
    //         try {
    //             // if (
    //             //     await this.repositoryModuleManager.isStateSynced(
    //             //         blockchain,
    //             //         contract,
    //             //         tokenId,
    //             //         stateIndex,
    //             //     )
    //             // ) {
    //             //     this.logger.trace(
    //             //         `ASSET_SYNC: StateIndex: ${stateIndex} for tokenId: ${tokenId} already synced blockchain: ${blockchain}`,
    //             //     );
    //             //     await this.repositoryModuleManager.updateAssetSyncRecord(
    //             //         blockchain,
    //             //         contract,
    //             //         tokenId,
    //             //         stateIndex,
    //             //         ASSET_SYNC_PARAMETERS.STATUS.COMPLETED,
    //             //         true,
    //             //     );
    //             //     continue;
    //             // }
    //
    //             const statePresentInParanetRepository = await this.tripleStoreService.assetExists(
    //                 paranet,
    //                 tokenId,
    //                 stateIndex,
    //                 assertionIds,
    //             );
    //
    //             if (await this.isStatePresentInRepository(tokenId, stateIndex, assertionIds)) {
    //                 this.logger.trace(
    //                     `ASSET_SYNC: StateIndex: ${stateIndex} for tokenId: ${tokenId} found in triple store blockchain: ${blockchain}`,
    //                 );
    //                 await this.repositoryModuleManager.createAssetSyncRecord(
    //                     blockchain,
    //                     contract,
    //                     tokenId,
    //                     stateIndex,
    //                     ASSET_SYNC_PARAMETERS.STATUS.COMPLETED,
    //                     true,
    //                 );
    //                 continue;
    //             }
    //
    //             const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
    //             this.logger.debug(
    //                 `ASSET_SYNC: Fetching state index: ${stateIndex + 1} of ${
    //                     assertionIds.length
    //                 } for asset with ual: ${ual}. blockchain: ${blockchain}`,
    //             );
    //             const assertionId = assertionIds[stateIndex];
    //
    //             const operationId = await this.operationIdService.generateOperationId(
    //                 OPERATION_ID_STATUS.GET.GET_START,
    //             );
    //
    //             await Promise.all([
    //                 this.operationIdService.updateOperationIdStatus(
    //                     operationId,
    //                     blockchain,
    //                     OPERATION_ID_STATUS.GET.GET_INIT_START,
    //                 ),
    //
    //                 this.repositoryModuleManager.createAssetSyncRecord(
    //                     blockchain,
    //                     contract,
    //                     tokenId,
    //                     stateIndex,
    //                     ASSET_SYNC_PARAMETERS.STATUS.IN_PROGRESS,
    //                 ),
    //
    //                 this.repositoryModuleManager.createOperationRecord(
    //                     this.getService.getOperationName(),
    //                     operationId,
    //                     OPERATION_STATUS.IN_PROGRESS,
    //                 ),
    //             ]);
    //
    //             const hashFunctionId = CONTENT_ASSET_HASH_FUNCTION_ID;
    //
    //             this.logger.debug(
    //                 `ASSET_SYNC: Get for ${ual} with operation id ${operationId} initiated. blockchain: ${blockchain}`,
    //             );
    //
    //             await this.commandExecutor.add({
    //                 name: 'networkGetCommand',
    //                 sequence: [],
    //                 delay: 0,
    //                 data: {
    //                     operationId,
    //                     id: ual,
    //                     blockchain,
    //                     contract,
    //                     tokenId,
    //                     state: assertionId,
    //                     hashFunctionId,
    //                     assertionId,
    //                     assetSync: true,
    //                     stateIndex,
    //                     assetSyncInsertedByCommand: true,
    //                 },
    //                 transactional: false,
    //             });
    //
    //             await this.operationIdService.updateOperationIdStatus(
    //                 operationId,
    //                 blockchain,
    //                 OPERATION_ID_STATUS.GET.GET_INIT_END,
    //             );
    //
    //             let attempt = 0;
    //             let getResult;
    //             do {
    //                 await setTimeout(ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_INTERVAL_MILLIS);
    //
    //                 getResult = await this.operationIdService.getOperationIdRecord(operationId);
    //                 attempt += 1;
    //             } while (
    //                 attempt < ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_MAX_ATTEMPTS &&
    //                 getResult?.status !== OPERATION_ID_STATUS.FAILED &&
    //                 getResult?.status !== OPERATION_ID_STATUS.COMPLETED
    //             );
    //         } catch (error) {
    //             this.logger.warn(
    //                 `ASSET_SYNC: Unable to sync tokenId: ${tokenId}, for contract: ${contract} state index: ${stateIndex} blockchain: ${blockchain}, error: ${error}`,
    //             );
    //             await this.repositoryModuleManager.updateAssetSyncRecord(
    //                 blockchain,
    //                 contract,
    //                 tokenId,
    //                 stateIndex,
    //                 ASSET_SYNC_PARAMETERS.STATUS.FAILED,
    //                 true,
    //             );
    //         }
    //     }
    // }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command) {
        this.logger.warn(`Failed to execute ${command.name}. Error: ${command.message}`);

        return Command.repeat();
    }

    /**
     * Builds default paranetSyncCommands
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'paranetSyncCommands',
            data: {},
            transactional: false,
            period: PARANET_SYNC_FREQUENCY_MILLS,
        };
        Object.assign(command, map);
        return command;
    }
}

export default StartParanetSyncCommands;
