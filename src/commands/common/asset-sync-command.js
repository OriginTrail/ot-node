/* eslint-disable no-await-in-loop */
import { queue } from 'async';
import { setTimeout } from 'timers/promises';
import Command from '../command.js';
import {
    ASSET_SYNC_PARAMETERS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    OPERATION_STATUS,
    OPERATION_ID_STATUS,
    TRIPLE_STORE_REPOSITORIES,
} from '../../constants/constants.js';
import MigrationExecutor from '../../migration/migration-executor.js';

class AssetSyncCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.commandExecutor = ctx.commandExecutor;
        this.ualService = ctx.ualService;
        this.getService = ctx.getService;
        this.fileService = ctx.fileService;
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
        const migrationExecuted = await MigrationExecutor.migrationAlreadyExecuted(
            'ualExtensionTripleStoreMigration',
            this.fileService,
        );
        if (!migrationExecuted) {
            this.logger.info(
                'Asset sync command will be postponed until ual extension triple store migration is completed',
            );
            return Command.repeat();
        }

        this.logger.debug(`Started executing asset sync command`);

        const syncQueue = queue(async (asset) => {
            await this.syncAsset(asset.tokenId, asset.blockchain, asset.contract);
        }, ASSET_SYNC_PARAMETERS.CONCURRENCY);

        const promises = [];
        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            promises.push(this.syncBlockchain(blockchain, syncQueue));
        }
        await Promise.all(promises);
        await new Promise((resolve) => {
            syncQueue.drain(resolve);
        });

        this.logger.debug(`Finished executing asset sync command`);

        return Command.repeat();
    }

    async syncBlockchain(blockchain, syncQueue) {
        const contracts = this.blockchainModuleManager.getAssetStorageContractAddresses(blockchain);

        for (const contract of contracts) {
            const latestTokenId = Number(
                await this.blockchainModuleManager.getLatestTokenId(blockchain, contract),
            );

            const latestAssetSyncRecord =
                await this.repositoryModuleManager.getLatestAssetSyncRecord(blockchain, contract);

            const latestSyncedTokenId = latestAssetSyncRecord?.tokenId ?? 0;

            if (latestSyncedTokenId > 0) {
                const tokenIds = await this.getMissedTokenIds(blockchain, contract);
                if (tokenIds?.length) {
                    this.logger.info(
                        `ASSET_SYNC: Found ${tokenIds.length} missed assets, syncing for blockchain: ${blockchain}`,
                    );
                    for (const tokenId of tokenIds) {
                        syncQueue.push({ tokenId, blockchain, contract });
                    }
                }
            }

            for (let tokenId = latestSyncedTokenId; tokenId < latestTokenId; tokenId += 1) {
                syncQueue.push({ tokenId, blockchain, contract });
            }
        }
    }

    async syncAsset(tokenId, blockchain, contract) {
        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );

        for (let stateIndex = 0; stateIndex < assertionIds.length; stateIndex += 1) {
            if (
                await this.repositoryModuleManager.isStateSynced(
                    blockchain,
                    contract,
                    tokenId,
                    stateIndex,
                )
            ) {
                this.logger.trace(
                    `ASSET_SYNC: StateIndex: ${stateIndex} for tokenId: ${tokenId} already synced blockchain: ${blockchain}`,
                );
                await this.repositoryModuleManager.updateAssetSyncRecord(
                    blockchain,
                    contract,
                    tokenId,
                    stateIndex,
                    ASSET_SYNC_PARAMETERS.STATUS.COMPLETED,
                    true,
                );
                continue;
            }

            if (await this.isStatePresentInRepository(tokenId, stateIndex, assertionIds)) {
                this.logger.trace(
                    `ASSET_SYNC: StateIndex: ${stateIndex} for tokenId: ${tokenId} found in triple store blockchain: ${blockchain}`,
                );
                await this.repositoryModuleManager.createAssetSyncRecord(
                    blockchain,
                    contract,
                    tokenId,
                    stateIndex,
                    ASSET_SYNC_PARAMETERS.STATUS.COMPLETED,
                    true,
                );
                continue;
            }

            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
            this.logger.debug(
                `ASSET_SYNC: Fetching state index: ${stateIndex + 1} of ${
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

                this.repositoryModuleManager.createAssetSyncRecord(
                    blockchain,
                    contract,
                    tokenId,
                    stateIndex,
                    ASSET_SYNC_PARAMETERS.STATUS.IN_PROGRESS,
                ),

                this.repositoryModuleManager.createOperationRecord(
                    this.getService.getOperationName(),
                    operationId,
                    OPERATION_STATUS.IN_PROGRESS,
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
                await setTimeout(ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_INTERVAL_MILLIS);

                getResult = await this.operationIdService.getOperationIdRecord(operationId);
                attempt += 1;
            } while (
                attempt < ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_MAX_ATTEMPTS &&
                getResult?.status !== OPERATION_ID_STATUS.FAILED &&
                getResult?.status !== OPERATION_ID_STATUS.COMPLETED
            );
        }
    }

    async getMissedTokenIds(blockchain, contract) {
        const tokenIds = await this.repositoryModuleManager.getAssetSyncTokenIds(
            blockchain,
            contract,
        );
        const tokenIdsSet = new Set(tokenIds); // Convert array to set for O(1) lookup
        const missedTokenIds = [];

        if (tokenIds.length - 1 !== tokenIds[tokenIds.length - 1]) {
            for (let i = 0; i < tokenIds[tokenIds.length - 1]; i += 1) {
                if (!tokenIdsSet.has(i)) {
                    missedTokenIds.push(i);
                }
                if (i % 10_000 === 0) {
                    // yield control to event loop
                    await new Promise((resolve) => {
                        setImmediate(resolve);
                    });
                }
            }
        }

        return missedTokenIds;
    }

    async isStatePresentInRepository(tokenId, stateIndex, assertionIds) {
        const repository =
            assertionIds.length - 1 === stateIndex
                ? TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT
                : TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY;
        this.logger.debug(
            `ASSET_SYNC: Checking if stateIndex: ${stateIndex} for tokenId: ${tokenId} exists in repository: ${repository}`,
        );

        return this.tripleStoreService.assertionExists(repository, assertionIds[stateIndex]);
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
