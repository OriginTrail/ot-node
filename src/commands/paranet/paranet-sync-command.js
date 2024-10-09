/* eslint-disable no-unused-vars */
/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';
import Command from '../command.js';
import {
    ERROR_TYPE,
    PARANET_SYNC_FREQUENCY_MILLS,
    OPERATION_ID_STATUS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    SIMPLE_ASSET_SYNC_PARAMETERS,
    TRIPLE_STORE_REPOSITORIES,
    PARANET_SYNC_KA_COUNT,
    PARANET_SYNC_RETRIES_LIMIT,
    PARANET_SYNC_RETRY_DELAY_MS,
    OPERATION_STATUS,
    PARANET_NODES_ACCESS_POLICIES,
} from '../../constants/constants.js';

class ParanetSyncCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;
        this.paranetService = ctx.paranetService;
        this.getService = ctx.getService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.PARANET.PARANET_SYNC_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            operationId,
            paranetUAL,
            paranetId,
            paranetMetadata,
        } = command.data;

        const paranetNodesAccessPolicy =
            PARANET_NODES_ACCESS_POLICIES[paranetMetadata.nodesAccessPolicy];

        this.logger.info(
            `Paranet sync: Starting paranet sync for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}`,
        );

        // Fetch counts from blockchain and database
        let contractKaCount = await this.blockchainModuleManager.getParanetKnowledgeAssetsCount(
            blockchain,
            paranetId,
        );
        contractKaCount = contractKaCount.toNumber();

        const cachedKaCount = (
            await this.repositoryModuleManager.getParanetKnowledgeAssetsCount(paranetId, blockchain)
        )[0].dataValues.ka_count;

        const totalCachedMissedKaCount =
            await this.repositoryModuleManager.getCountOfMissedAssetsOfParanet(paranetUAL);
        const cachedMissedKaCount =
            await this.repositoryModuleManager.getFilteredCountOfMissedAssetsOfParanet(
                paranetUAL,
                PARANET_SYNC_RETRIES_LIMIT,
                PARANET_SYNC_RETRY_DELAY_MS,
            );

        this.logger.info(
            `Paranet sync: Total amount of missed assets: ${totalCachedMissedKaCount}`,
        );

        // First, attempt to sync missed KAs if any exist
        if (cachedMissedKaCount > 0) {
            this.logger.info(
                `Paranet sync: Attempting to sync ${cachedMissedKaCount} missed assets for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}!`,
            );

            await this.syncMissedKAs(
                paranetUAL,
                paranetId,
                blockchain,
                contract,
                tokenId,
                paranetMetadata,
                paranetNodesAccessPolicy,
                operationId,
                cachedKaCount,
            );
        }

        // Then, check for new KAs on the blockchain
        if (cachedKaCount + cachedMissedKaCount < contractKaCount) {
            this.logger.info(
                `Paranet sync: Syncing ${
                    contractKaCount - (cachedKaCount + cachedMissedKaCount)
                } new assets for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}`,
            );

            await this.syncNewKAs(
                cachedKaCount + cachedMissedKaCount,
                contractKaCount,
                paranetUAL,
                paranetId,
                blockchain,
                contract,
                tokenId,
                paranetMetadata,
                paranetNodesAccessPolicy,
                operationId,
                cachedKaCount,
            );
        } else {
            this.logger.info(
                `Paranet sync: No new assets to sync for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}!`,
            );
        }

        return Command.repeat();
    }

    async syncAssetState(
        blockchain,
        contract,
        tokenId,
        assertionIds,
        stateIndex,
        paranetId,
        paranetTokenId,
        paranetRepository,
        latestAsset,
        deleteFromEarlier,
        paranetUAL,
        knowledgeAssetId,
        paranetNodesAccessPolicy,
        paranetMetadata,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        try {
            const statePresentInParanetRepository =
                await this.tripleStoreService.paranetAssetExists(
                    blockchain,
                    contract,
                    tokenId,
                    contract,
                    paranetTokenId,
                );

            if (statePresentInParanetRepository) {
                this.logger.trace(
                    `Paranet sync: StateIndex: ${stateIndex} for tokenId: ${tokenId} found in triple store blockchain: ${blockchain}`,
                );
                return true;
            }

            this.logger.debug(
                `Paranet sync: Fetching state index: ${stateIndex + 1} of ${
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
                this.repositoryModuleManager.createOperationRecord(
                    this.getService.getOperationName(),
                    operationId,
                    OPERATION_STATUS.IN_PROGRESS,
                ),
            ]);

            this.logger.debug(
                `Paranet sync: Get for ${ual} with operation id ${operationId} initiated. blockchain: ${blockchain}`,
            );

            if (paranetNodesAccessPolicy === 'OPEN') {
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
                        hashFunctionId: CONTENT_ASSET_HASH_FUNCTION_ID,
                        assertionId,
                        assetSync: true,
                        stateIndex,
                        paranetSync: true,
                        paranetTokenId,
                        paranetLatestAsset: latestAsset,
                        paranetMetadata,
                    },
                    transactional: false,
                });
            } else if (paranetNodesAccessPolicy === 'CURATED') {
                await this.commandExecutor.add({
                    name: 'curatedParanetNetworkGetCommand',
                    sequence: [],
                    delay: 0,
                    data: {
                        operationId,
                        id: ual,
                        blockchain,
                        contract,
                        tokenId,
                        state: assertionId,
                        hashFunctionId: CONTENT_ASSET_HASH_FUNCTION_ID,
                        assertionId,
                        assetSync: true,
                        stateIndex,
                        paranetSync: true,
                        paranetTokenId,
                        paranetLatestAsset: latestAsset,
                        paranetUAL,
                        paranetId,
                        paranetMetadata,
                    },
                    transactional: false,
                });
            }

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.GET.GET_INIT_END,
            );

            let attempt = 0;
            let getResult;
            do {
                await setTimeout(SIMPLE_ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_INTERVAL_MILLIS);
                getResult = await this.operationIdService.getOperationIdRecord(operationId);
                attempt += 1;
            } while (
                attempt < SIMPLE_ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_MAX_ATTEMPTS &&
                getResult?.status !== OPERATION_ID_STATUS.FAILED &&
                getResult?.status !== OPERATION_ID_STATUS.COMPLETED
            );

            const getOperationCachedData = await this.operationIdService.getCachedOperationIdData(
                operationId,
            );
            if (getOperationCachedData?.message === 'Unable to find assertion on the network!') {
                await this.repositoryModuleManager.createMissedParanetAssetRecord({
                    blockchainId: blockchain,
                    ual,
                    paranetUal: paranetUAL,
                    knowledgeAssetId,
                });
                return false;
            }
        } catch (error) {
            this.logger.warn(
                `Paranet sync: Unable to sync tokenId: ${tokenId}, for contract: ${contract} state index: ${stateIndex} blockchain: ${blockchain}, error: ${error}`,
            );
            await this.repositoryModuleManager.createMissedParanetAssetRecord({
                blockchainId: blockchain,
                ual,
                paranetUal: paranetUAL,
                knowledgeAssetId,
            });

            return false;
        }

        return true;
    }

    async syncAsset(
        knowledgeAssetId,
        blockchain,
        contract,
        tokenId,
        paranetUAL,
        paranetId,
        paranetMetadata,
        paranetNodesAccessPolicy,
        operationId,
        removeMissingAssetRecord = false,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        try {
            this.logger.info(
                `Paranet sync: Syncing asset ID: ${knowledgeAssetId} for paranet: ${paranetId}, operation ID: ${operationId}`,
            );

            const { knowledgeAssetStorageContract, tokenId: kaTokenId } =
                await this.blockchainModuleManager.getParanetKnowledgeAssetLocator(
                    blockchain,
                    knowledgeAssetId,
                );

            const assertionIds = await this.blockchainModuleManager.getAssertionIds(
                blockchain,
                knowledgeAssetStorageContract,
                kaTokenId,
            );

            let isSuccessful = true;
            for (let stateIndex = 0; stateIndex < assertionIds.length; stateIndex += 1) {
                isSuccessful =
                    isSuccessful &&
                    (await this.syncAssetState(
                        blockchain,
                        knowledgeAssetStorageContract,
                        kaTokenId,
                        assertionIds,
                        stateIndex,
                        paranetId,
                        tokenId,
                        stateIndex === assertionIds.length - 1
                            ? TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT
                            : TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                        stateIndex === assertionIds.length - 1,
                        paranetUAL,
                        knowledgeAssetId,
                        paranetNodesAccessPolicy,
                        paranetMetadata,
                    ));
            }

            if (isSuccessful && removeMissingAssetRecord) {
                await this.repositoryModuleManager.removeMissedParanetAssetRecordsByUAL(ual);
            }

            return isSuccessful;
        } catch (error) {
            this.logger.warn(
                `Paranet sync: Failed to sync asset ID: ${knowledgeAssetId} for paranet: ${paranetId}, error: ${error}`,
            );
            await this.repositoryModuleManager.createMissedParanetAssetRecord({
                blockchain,
                ual,
                paranetUAL,
                knowledgeAssetId,
            });
            return false;
        }
    }

    async syncMissedKAs(
        paranetUAL,
        paranetId,
        blockchain,
        contract,
        tokenId,
        paranetMetadata,
        paranetNodesAccessPolicy,
        operationId,
        cachedKaCount,
    ) {
        const missedParanetAssets =
            await this.repositoryModuleManager.getMissedParanetAssetsRecordsWithRetryCount(
                paranetUAL,
                PARANET_SYNC_RETRIES_LIMIT,
                PARANET_SYNC_RETRY_DELAY_MS,
                PARANET_SYNC_KA_COUNT,
            );

        const promises = missedParanetAssets.map((missedParanetAsset) =>
            this.syncAsset(
                missedParanetAsset.ual,
                missedParanetAsset.knowledgeAssetId,
                blockchain,
                contract,
                tokenId,
                paranetUAL,
                paranetId,
                paranetMetadata,
                paranetNodesAccessPolicy,
                operationId,
                true,
            ),
        );

        const results = await Promise.all(promises);

        const successfulCount = results.filter(Boolean).length;
        if (successfulCount > 0) {
            await this.repositoryModuleManager.updateParanetKaCount(
                paranetId,
                blockchain,
                cachedKaCount + successfulCount,
            );
        }
    }

    async syncNewKAs(
        startIndex,
        contractKaCount,
        paranetUAL,
        paranetId,
        blockchain,
        contract,
        tokenId,
        paranetMetadata,
        paranetNodesAccessPolicy,
        operationId,
        cachedKaCount,
    ) {
        const kasToSync = [];

        for (let i = startIndex + 1; i <= contractKaCount; i += PARANET_SYNC_KA_COUNT) {
            const nextKaArray =
                await this.blockchainModuleManager.getParanetKnowledgeAssetsWithPagination(
                    blockchain,
                    paranetId,
                    i,
                    PARANET_SYNC_KA_COUNT,
                );
            if (!nextKaArray.length) break;
            kasToSync.push(...nextKaArray);
        }

        const promises = kasToSync.map((knowledgeAssetId) =>
            this.syncAsset(
                knowledgeAssetId,
                blockchain,
                contract,
                tokenId,
                paranetUAL,
                paranetId,
                paranetMetadata,
                paranetNodesAccessPolicy,
                operationId,
            ),
        );

        const results = await Promise.all(promises);

        const successfulCount = results.filter(Boolean).length;
        if (successfulCount > 0) {
            await this.repositoryModuleManager.updateParanetKaCount(
                paranetId,
                blockchain,
                cachedKaCount + successfulCount,
            );
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
