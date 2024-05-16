/* eslint-disable no-unused-vars */
/* eslint-disable no-await-in-loop */
import Command from '../command.js';
import {
    ERROR_TYPE,
    PARANET_SYNC_FREQUENCY_MILLS,
    OPERATION_ID_STATUS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    SIMPLE_ASSET_SYNC_PARAMETERS,
    TRIPLE_STORE_REPOSITORIES,
    PARANET_SYNC_KA_COUNT,
} from '../../constants/constants.js';

class ParanetSyncCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;
        this.paranetService = ctx.paranetService;

        this.errorType = ERROR_TYPE.PARANET.PARANET_SYNC_ERROR;
    }

    async execute(command) {
        const { commandOperationId, paranetUAL } = command.data;

        const { blockchain, contract, tokenId } = this.ualService.resolveUAL(paranetUAL);
        const paranetId = this.paranetService.constructParanetId(blockchain, contract, tokenId);

        this.logger.info(
            `Paranet sync: Starting paranet sync for paranetId: ${paranetId}, operation ID: ${commandOperationId}`,
        );

        const contractKaCount = await this.blockchainModuleManager.getKnowledgeAssetsCount(
            blockchain,
            paranetId,
        );
        const [cachedKaCount] = await this.repositoryModuleManager.getKACount(
            paranetId,
            blockchain,
        );

        if (cachedKaCount === contractKaCount) {
            this.logger.info(
                `Paranet sync: KA count from contract and in DB is the same, nothing to sync, for paranetId: ${paranetId}, operation ID: ${commandOperationId}!`,
            );
            return Command.empty();
        }

        this.logger.info(
            `Paranet sync: Syncing ${
                contractKaCount - cachedKaCount + 1
            } assets for paranetId: ${paranetId}, operation ID: ${commandOperationId}`,
        );
        // TODO: Rename i, should it be cachedKaCount + 1 as cachedKaCount is already in, but count is index
        const kaToUpdate = [];
        for (let i = cachedKaCount; i <= contractKaCount; i += PARANET_SYNC_KA_COUNT) {
            const nextKaArray = this.blockchainModuleManager.getKnowledgeAssetsWithPagination(
                blockchain,
                paranetId,
                i,
                PARANET_SYNC_KA_COUNT,
            );
            if (!nextKaArray.length) break;
            kaToUpdate.push(...nextKaArray);
        }
        // To this as batch of promises
        // Wrapt it in try catch with retry
        kaToUpdate
            // It's array of keywords not tokenId
            // .map((ka) => ka.tokenId)
            .forEach(async (knowledgeAssetId) => {
                this.logger.info(
                    `Paranet sync: Syncing token id: ${knowledgeAssetId} for ${paranetId} with operation id: ${commandOperationId}`,
                );

                const { kaContract } = this.blockchainModuleManager.getKnowledgeAssetLocator(
                    blockchain,
                    knowledgeAssetId,
                );

                // Does this return unfainalized changes
                const assertionIds = await this.blockchainModuleManager.getLatestAssertionId(
                    blockchain,
                    kaContract,
                    tokenId,
                );

                // Go through all except the last one
                // TODO: Do it in promises as a batch
                for (let stateIndex = assertionIds.length - 2; stateIndex >= 0; stateIndex -= 1) {
                    await this.syncAsset(
                        blockchain,
                        kaContract,
                        tokenId,
                        assertionIds,
                        stateIndex,
                        paranetId,
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                        false,
                        // It should never delete as it never was in storage
                        // But maybe will becouse this is unfainalized
                        stateIndex === assertionIds.length - 2,
                    );
                }

                // Then sync the last one, but put it in the current repo
                await this.syncAsset(
                    blockchain,
                    kaContract,
                    tokenId,
                    assertionIds,
                    assertionIds.length - 1,
                    paranetId,
                    null,
                    false,
                    false,
                );
            });

        // TODO: Save only successful ones
        // Here is the problme if one missed count will be false and we will always try to get it again
        await this.repositoryModuleManager.updateParanetKaCount(paranetId, contractKaCount);

        return Command.repeat();
    }

    async syncAsset(
        blockchain,
        contract,
        tokenId,
        assertionIds,
        stateIndex,
        paranetId,
        paranetRepository,
        latestAsset,
        deleteFromEarlier,
    ) {
        try {
            const statePresentInParanetRepository =
                await this.tripleStoreService.paranetAssetExists(
                    paranetId,
                    tokenId,
                    stateIndex,
                    assertionIds,
                );

            if (statePresentInParanetRepository) {
                this.logger.trace(
                    `PARANET_SYNC: StateIndex: ${stateIndex} for tokenId: ${tokenId} found in triple store blockchain: ${blockchain}`,
                );
                // await this.repositoryModuleManager.createAssetSyncRecord(
                //     blockchain,
                //     contract,
                //     tokenId,
                //     stateIndex,
                //     SIMPLE_ASSET_SYNC_PARAMETERS.STATUS.COMPLETED,
                //     true,
                // );
                return;
            }

            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
            this.logger.debug(
                `PARANET_SYNC: Fetching state index: ${stateIndex + 1} of ${
                    assertionIds.length
                } for asset with ual: ${ual}. blockchain: ${blockchain}`,
            );
            const assertionId = assertionIds[stateIndex];

            const operationId = await this.operationIdService.generateOperationId(
                OPERATION_ID_STATUS.GET.GET_START,
            );

            await Promise.all([
                this.operationIdService.updateOperationIdStatus(
                    operationId,
                    blockchain,
                    OPERATION_ID_STATUS.GET.GET_INIT_START,
                ),

                // this.repositoryModuleManager.createAssetSyncRecord(
                //     blockchain,
                //     contract,
                //     tokenId,
                //     stateIndex,
                //     SIMPLE_ASSET_SYNC_PARAMETERS.STATUS.IN_PROGRESS,
                // ),

                this.repositoryModuleManager.createOperationRecord(
                    this.getService.getOperationName(),
                    operationId,
                    OPERATION_ID_STATUS.IN_PROGRESS,
                ),
            ]);

            const hashFunctionId = CONTENT_ASSET_HASH_FUNCTION_ID;

            this.logger.debug(
                `ASSET_SYNC: Get for ${ual} with operation id ${operationId} initiated. blockchain: ${blockchain}`,
            );

            await this.commandExecutor.add({
                name: 'networkGetCommand',
                sequence: [],
                delay: 0,
                data: {
                    operationId,
                    id: ual,
                    blockchain,
                    contract,
                    tokenId,
                    state: assertionId,
                    hashFunctionId,
                    assertionId,
                    assetSync: true,
                    stateIndex,
                    assetSyncInsertedByCommand: true,
                    paranetSync: true,
                    paranetId,
                    paranetRepoId: paranetRepository,
                    paranetLatestAsset: latestAsset,
                    paranetDeleteFromEarlier: deleteFromEarlier,
                },
                transactional: false,
            });

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.GET.GET_INIT_END,
            );

            let attempt = 0;
            let getResult;
            do {
                // TODO: Import timeout
                await setTimeout(SIMPLE_ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_INTERVAL_MILLIS);
                getResult = await this.operationIdService.getOperationIdRecord(operationId);
                attempt += 1;
            } while (
                attempt < SIMPLE_ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_MAX_ATTEMPTS &&
                getResult?.status !== OPERATION_ID_STATUS.FAILED &&
                getResult?.status !== OPERATION_ID_STATUS.COMPLETED
            );
        } catch (error) {
            this.logger.warn(
                `ASSET_SYNC: Unable to sync tokenId: ${tokenId}, for contract: ${contract} state index: ${stateIndex} blockchain: ${blockchain}, error: ${error}`,
            );
            // await this.repositoryModuleManager.updateAssetSyncRecord(
            //     blockchain,
            //     contract,
            //     tokenId,
            //     stateIndex,
            //     SIMPLE_ASSET_SYNC_PARAMETERS.STATUS.FAILED,
            //     true,
            // );
        }
    }

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

export default ParanetSyncCommand;
