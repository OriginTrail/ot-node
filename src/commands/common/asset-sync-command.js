/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';
import Command from '../command.js';
import {
    ASSET_SYNC_PARAMETERS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    OPERATION_STATUS,
    OPERATION_ID_STATUS,
    TRIPLE_STORE_REPOSITORIES,
    GET_STATES,
} from '../../constants/constants.js';

class AssetSyncCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.commandExecutor = ctx.commandExecutor;
        this.ualService = ctx.ualService;
        this.getService = ctx.getService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        if (!this.config.assetSync.enabled) {
            this.logger.warn(
                `Skipping execution of ${command.name} as assetSync is not enabled in configuration`,
            );
            return Command.empty();
        }

        this.logger.debug(`Started executing asset sync command`);

        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            const contracts =
                this.blockchainModuleManager.getAssetStorageContractAddresses(blockchain);

            for (const contract of contracts) {
                const latestTokenId = Number(
                    await this.blockchainModuleManager.getLatestTokenId(blockchain, contract),
                );

                const latestAssetSyncRecord =
                    await this.repositoryModuleManager.getLatestAssetSyncRecord(
                        blockchain,
                        contract,
                    );

                const latestSyncedTokenId = latestAssetSyncRecord?.tokenId ?? 0;
                const latestSyncedStateIndex = latestAssetSyncRecord?.stateIndex ?? -1;

                await this.syncMissedAssets(
                    blockchain,
                    contract,
                    latestSyncedTokenId,
                    latestSyncedStateIndex,
                );

                for (let tokenId = latestSyncedTokenId; tokenId < latestTokenId; tokenId += 1) {
                    await this.syncAsset(
                        tokenId,
                        latestSyncedTokenId,
                        latestSyncedStateIndex,
                        blockchain,
                        contract,
                    );
                }
            }
        }

        this.logger.debug(`Finished executing asset sync command`);

        return Command.repeat();
    }

    async syncAsset(tokenId, latestSyncedTokenId, lastSyncedStateIndex, blockchain, contract) {
        let latestSyncedStateIndex = lastSyncedStateIndex;
        if (tokenId !== latestSyncedTokenId) {
            // StateIndex is -1 for all except
            // for the last synced token id
            latestSyncedStateIndex = -1;
        }

        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );

        for (
            let stateIndex = latestSyncedStateIndex + 1;
            stateIndex < assertionIds.length;
            stateIndex += 1
        ) {
            // Skip if it is not latest state
            // TODO: Remove this skip when GET historical state is implemented
            if (stateIndex < assertionIds.length - 1) {
                continue;
            }

            if (
                await this.repositoryModuleManager.isStateSynced(
                    blockchain,
                    contract,
                    tokenId,
                    stateIndex,
                )
            ) {
                await this.repositoryModuleManager.updateAssetSyncRecord(
                    blockchain,
                    contract,
                    tokenId,
                    stateIndex,
                    ASSET_SYNC_PARAMETERS.STATUS.COMPLETED,
                );
                continue;
            }

            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
            this.logger.debug(
                `ASSET_SYNC: Fetching state index: ${stateIndex + 1} of ${
                    assertionIds.length
                } for asset with ual: ${ual}.`,
            );
            const assertionId = assertionIds[stateIndex];

            const operationId = await this.operationIdService.generateOperationId(
                OPERATION_ID_STATUS.GET.GET_START,
            );

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.GET.GET_INIT_START,
            );

            await this.repositoryModuleManager.createAssetSyncRecord(
                blockchain,
                contract,
                tokenId,
                stateIndex,
                ASSET_SYNC_PARAMETERS.STATUS.IN_PROGRESS,
            );

            await this.repositoryModuleManager.createOperationRecord(
                this.getService.getOperationName(),
                operationId,
                OPERATION_STATUS.IN_PROGRESS,
            );

            // TODO: Change to StateIndex, once GET historical state is implemented
            const state = GET_STATES.LATEST_FINALIZED;
            const hashFunctionId = CONTENT_ASSET_HASH_FUNCTION_ID;

            this.logger.info(`Get for ${ual} with operation id ${operationId} initiated.`);

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
                    state,
                    hashFunctionId,
                    assertionId,
                },
                transactional: false,
            });

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                OPERATION_ID_STATUS.GET.GET_INIT_END,
            );

            let attempt = 0;
            let getResult;
            do {
                await setTimeout(ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_INTERVAL_MILLIS);

                getResult = await this.operationIdService.getOperationIdRecord(operationId);
                attempt += 1;
            } while (
                attempt < ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_MAX_ATTEMPTS &&
                getResult?.status !== OPERATION_ID_STATUS.FAILED &&
                getResult?.status !== OPERATION_ID_STATUS.COMPLETED
            );

            const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);

            if (cachedData?.assertion?.length) {
                this.logger.debug(
                    `ASSET_SYNC: ${cachedData.assertion.length} nquads found for asset with ual: ${ual}, state index: ${stateIndex}, assertionId: ${assertionId}`,
                );
                const keyword = await this.ualService.calculateLocationKeyword(
                    blockchain,
                    contract,
                    tokenId,
                );

                await this.tripleStoreService.localStoreAsset(
                    stateIndex === assertionIds.length - 1
                        ? TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT
                        : TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                    assertionId,
                    cachedData.assertion,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                );
            } else {
                this.logger.debug(
                    `ASSET_SYNC: No nquads found for asset with ual: ${ual}, state index: ${stateIndex}, assertionId: ${assertionId}`,
                );
            }

            this.logger.debug(
                `ASSET_SYNC: Updating status for asset sync record with ual: ${ual}, state index: ${stateIndex}, assertionId: ${assertionId}, status: ${getResult?.status}`,
            );

            await this.repositoryModuleManager.updateAssetSyncRecord(
                blockchain,
                contract,
                tokenId,
                stateIndex,
                getResult.status,
            );
        }
    }

    async syncMissedAssets(blockchain, contract, latestSyncedTokenId, latestSyncedStateIndex) {
        const tokenIds = await this.getMissedTokenIds(blockchain, contract);
        if (tokenIds && tokenIds.length > 0) {
            this.logger.info(`ASSET_SYNC: Found ${tokenIds.length} missed assets, syncing`);
        }
        for (const tokenId in tokenIds) {
            await this.syncAsset(
                tokenId,
                latestSyncedTokenId,
                latestSyncedStateIndex,
                blockchain,
                contract,
            );
        }
    }

    async getMissedTokenIds(blockchain, contract) {
        const tokenIds = await this.repositoryModuleManager.getAssetSyncTokenIds(
            blockchain,
            contract,
        );
        const missedTokenIds = [];
        if (tokenIds.length() - 1 !== tokenIds[tokenIds.length() - 1]) {
            for (let i = 0; i < tokenIds[tokenIds.length() - 1]; i += 1) {
                if (!tokenIds.includes(i)) {
                    missedTokenIds.push(i);
                }
            }
        }

        return missedTokenIds;
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to sync knowledge assets: error: ${error.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'assetSyncCommand',
            data: {},
            period: ASSET_SYNC_PARAMETERS.COMMAND_FREQUENCY_MILLIS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default AssetSyncCommand;
