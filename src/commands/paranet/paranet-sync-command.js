/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';
import Command from '../command.js';
import {
    ERROR_TYPE,
    PARANET_SYNC_FREQUENCY_MILLS,
    OPERATION_ID_STATUS,
    PARANET_SYNC_PARAMETERS,
    PARANET_SYNC_KA_COUNT,
    PARANET_SYNC_RETRIES_LIMIT,
    PARANET_SYNC_RETRY_DELAY_MS,
    OPERATION_STATUS,
    PARANET_NODES_ACCESS_POLICIES,
    // PARANET_SYNC_SOURCES,
    // TRIPLE_STORE_REPOSITORIES,
    // LOCAL_INSERT_FOR_CURATED_PARANET_MAX_ATTEMPTS,
    // LOCAL_INSERT_FOR_CURATED_PARANET_RETRY_DELAY,
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
        const { blockchain, operationId, paranetUAL, paranetId, paranetMetadata } = command.data;

        const paranetNodesAccessPolicy =
            PARANET_NODES_ACCESS_POLICIES[paranetMetadata.nodesAccessPolicy];

        this.logger.info(
            `Paranet sync: Starting paranet sync for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}, access policy ${paranetNodesAccessPolicy}`,
        );

        // Fetch counts from blockchain and database
        const contractKaCount = (
            await this.blockchainModuleManager.getParanetKnowledgeCollectionCount(
                blockchain,
                paranetId,
            )
        ).toNumber();

        const syncedAssetsCount =
            await this.repositoryModuleManager.getParanetSyncedAssetRecordsCount(paranetUAL);

        const totalMissedAssetsCount =
            await this.repositoryModuleManager.getCountOfMissedAssetsOfParanet(paranetUAL);
        const missedAssetsCount =
            await this.repositoryModuleManager.getMissedParanetAssetsRecordsWithRetryCount(
                paranetUAL,
                PARANET_SYNC_RETRIES_LIMIT,
                PARANET_SYNC_RETRY_DELAY_MS,
            );

        const paranetRepository = this.paranetService.getParanetRepositoryName(paranetUAL);

        this.logger.info(
            `Paranet sync: Paranet: ${paranetUAL} (${paranetId}) Total count of Paranet KAs in the contract: ${contractKaCount}; Synced KAs count: ${syncedAssetsCount};  Total count of missed KAs: ${totalMissedAssetsCount}`,
        );

        // First, attempt to sync missed KAs if any exist
        if (missedAssetsCount > 0) {
            this.logger.info(
                `Paranet sync: Attempting to sync ${missedAssetsCount} missed assets for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}!`,
            );

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.PARANET.PARANET_SYNC_MISSED_KAS_SYNC_START,
            );

            const [successfulMissedSyncsCount, failedMissedSyncsCount] = await this.syncMissedKAs(
                paranetUAL,
                paranetId,
                paranetNodesAccessPolicy,
                paranetRepository,
                operationId,
            );

            this.logger.info(
                `Paranet sync: Successful missed assets syncs: ${successfulMissedSyncsCount}; ` +
                    `Failed missed assets syncs: ${failedMissedSyncsCount}  for paranet: ${paranetUAL} ` +
                    `(${paranetId}), operation ID: ${operationId}!`,
            );

            await this.operationIdService.updateOperationIdStatusWithValues(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.PARANET.PARANET_SYNC_MISSED_KAS_SYNC_END,
                successfulMissedSyncsCount,
                failedMissedSyncsCount,
            );
        }

        // Then, check for new KAs on the blockchain
        if (syncedAssetsCount + totalMissedAssetsCount < contractKaCount) {
            this.logger.info(
                `Paranet sync: Syncing ${
                    contractKaCount - (syncedAssetsCount + totalMissedAssetsCount)
                } new assets for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}`,
            );

            await this.operationIdService.updateOperationIdStatus(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.PARANET.PARANET_SYNC_NEW_KAS_SYNC_START,
            );

            const [successulNewSyncsCount, failedNewSyncsCount] = await this.syncNewKAs(
                blockchain,
                syncedAssetsCount + missedAssetsCount,
                contractKaCount,
                paranetUAL,
                paranetId,
                // paranetNodesAccessPolicy,
                // paranetRepository,
                // operationId,
            );

            this.logger.info(
                `Paranet sync: Successful new assets syncs: ${successulNewSyncsCount}; ` +
                    `Failed new assets syncs: ${failedNewSyncsCount}  for paranet: ${paranetUAL} ` +
                    `(${paranetId}), operation ID: ${operationId}!`,
            );

            await this.operationIdService.updateOperationIdStatusWithValues(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.PARANET.PARANET_SYNC_NEW_KAS_SYNC_END,
                successulNewSyncsCount,
                failedNewSyncsCount,
            );

            await this.operationIdService.updateOperationIdStatusWithValues(
                operationId,
                blockchain,
                OPERATION_ID_STATUS.COMPLETED,
                successulNewSyncsCount,
                failedNewSyncsCount,
            );
        } else {
            this.logger.info(
                `Paranet sync: No new assets to sync for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}!`,
            );
        }

        return Command.repeat();
    }

    async syncAssetState(
        ual,
        blockchain,
        contract,
        tokenId,
        assertionIds,
        stateIndex,
        paranetId,
        latestState,
        paranetUAL,
        paranetNodesAccessPolicy,
        paranetRepository,
    ) {
        const assertionId = assertionIds[stateIndex];

        this.logger.debug(
            `Paranet sync: Fetching state: ${assertionId} index: ${stateIndex + 1} of ${
                assertionIds.length
            } for asset with ual: ${ual}.`,
        );

        try {
            const getOperationId = await this.operationIdService.generateOperationId(
                OPERATION_ID_STATUS.GET.GET_START,
            );
            this.operationIdService.updateOperationIdStatus(
                getOperationId,
                blockchain,
                OPERATION_ID_STATUS.GET.GET_INIT_START,
            );
            this.repositoryModuleManager.createOperationRecord(
                this.getService.getOperationName(),
                getOperationId,
                OPERATION_STATUS.IN_PROGRESS,
            );
            this.logger.debug(
                `Paranet sync: Get for ${ual} with operation id ${getOperationId} initiated.`,
            );

            const maxAttempts = PARANET_SYNC_PARAMETERS.GET_RESULT_POLLING_MAX_ATTEMPTS;
            const pollingInterval = PARANET_SYNC_PARAMETERS.GET_RESULT_POLLING_INTERVAL_MILLIS;

            let attempt = 0;
            let getResult;

            await this.commandExecutor.add({
                name: 'localGetCommand',
                sequence: [],
                delay: 0,
                data: {
                    operationId: getOperationId,
                    id: ual,
                    blockchain,
                    contract,
                    tokenId,
                    state: assertionId,
                    assertionId,
                    paranetId,
                    paranetUAL,
                },
                transactional: false,
            });

            do {
                await setTimeout(pollingInterval);
                getResult = await this.operationIdService.getOperationIdRecord(getOperationId);
                attempt += 1;
            } while (
                attempt < maxAttempts &&
                getResult?.status !== OPERATION_ID_STATUS.FAILED &&
                getResult?.status !== OPERATION_ID_STATUS.COMPLETED
            );

            if (getResult?.status !== OPERATION_ID_STATUS.COMPLETED) {
                this.logger.info(
                    `Local GET failed for tokenId: ${tokenId}, attempting network GET.`,
                );

                const networkCommandName =
                    paranetNodesAccessPolicy === 'OPEN'
                        ? 'networkGetCommand'
                        : 'curatedParanetNetworkGetCommand';

                await this.commandExecutor.add({
                    name: networkCommandName,
                    sequence: [],
                    delay: 0,
                    data: {
                        operationId: getOperationId,
                        id: ual,
                        blockchain,
                        contract,
                        tokenId,
                        state: assertionId,
                        assertionId,
                        paranetId,
                        paranetUAL,
                    },
                    transactional: false,
                });

                attempt = 0;
                do {
                    await setTimeout(pollingInterval);
                    getResult = await this.operationIdService.getOperationIdRecord(getOperationId);
                    attempt += 1;
                } while (
                    attempt < maxAttempts &&
                    getResult?.status !== OPERATION_ID_STATUS.FAILED &&
                    getResult?.status !== OPERATION_ID_STATUS.COMPLETED
                );
            }

            if (getResult?.status !== OPERATION_ID_STATUS.COMPLETED) {
                this.logger.warn(
                    `Paranet sync: Unable to sync tokenId: ${tokenId}, for contract: ${contract}, state index: ${stateIndex}, blockchain: ${blockchain}, GET result: ${JSON.stringify(
                        getResult,
                    )}`,
                );

                // TODO: if exists, increase retry count
                await this.repositoryModuleManager.incrementRetriesForUalAndParanetUal(
                    ual,
                    paranetUAL,
                );

                return false;
            }

            const data = await this.operationIdService.getCachedOperationIdData(getOperationId);
            this.logger.debug(
                `Paranet sync: ${data.assertion.length} nquads found for asset with ual: ${ual}, state index: ${stateIndex}, assertionId: ${assertionId}`,
            );

            const repository = paranetRepository;

            const assertions = [data.public, data.private];

            const storePromises = [];

            for (const assertionData of assertions) {
                if (assertionData?.assertion && assertionData?.assertionId) {
                    storePromises.push(
                        this.tripleStoreService.insertKnowledgeCollection(
                            repository,
                            ual,
                            assertionData.assertion,
                        ),
                    );
                }
            }

            await Promise.all(storePromises);

            // this doesnt work for v8
            // await this.tripleStoreService.localStoreAsset(
            //     repository,
            //     assertionId,
            //     data.assertion,
            //     blockchain,
            //     contract,
            //     tokenId,
            //     LOCAL_INSERT_FOR_CURATED_PARANET_MAX_ATTEMPTS,
            //     LOCAL_INSERT_FOR_CURATED_PARANET_RETRY_DELAY,
            // );
            // if (paranetNodesAccessPolicy === 'CURATED' && data.privateAssertion) {
            //     await this.tripleStoreService.localStoreAsset(
            //         repository,
            //         data.syncedAssetRecord.privateAssertionId,
            //         data.privateAssertion,
            //         blockchain,
            //         contract,
            //         tokenId,
            //     );
            // }
            // const privateAssertionId =
            //     paranetNodesAccessPolicy === 'CURATED'
            //         ? data.syncedAssetRecord?.privateAssertionId
            //         : null;

            await this.repositoryModuleManager.incrementParanetKaCount(paranetId, blockchain);

            await this.repositoryModuleManager.updateAssetToBeSynced(ual, paranetUAL);

            return true;
        } catch (error) {
            this.logger.warn(
                `Paranet sync: Unable to sync tokenId: ${tokenId}, for contract: ${contract} state index: ${stateIndex} blockchain: ${blockchain}, error: ${error}`,
            );

            // TODO: probably dont need to do anything here and just leave it unsynced, maybe increase retry count
            await this.repositoryModuleManager.incrementRetriesForUalAndParanetUal(ual, paranetUAL);

            return false;
        }
    }

    async syncAsset(
        ual,
        blockchain,
        contract,
        tokenId,
        paranetUAL,
        paranetId,
        paranetNodesAccessPolicy,
        paranetRepository,
        operationId,
    ) {
        try {
            this.logger.info(
                `Paranet sync: Syncing asset: ${ual} for paranet: ${paranetId}, operation ID: ${operationId}`,
            );

            const assertionIds =
                await this.blockchainModuleManager.getKnowledgeCollectionMerkleRoots(
                    blockchain,
                    contract,
                    tokenId,
                );

            let isSuccessful = true;
            for (let stateIndex = 0; stateIndex < assertionIds.length; stateIndex += 1) {
                isSuccessful =
                    isSuccessful &&
                    (await this.syncAssetState(
                        ual,
                        blockchain,
                        contract,
                        tokenId,
                        assertionIds,
                        stateIndex,
                        paranetId,
                        stateIndex === assertionIds.length - 1,
                        paranetUAL,
                        paranetNodesAccessPolicy,
                        paranetRepository,
                    ));
            }

            // if (isSuccessful && removeMissingAssetRecord) {
            //     await this.repositoryModuleManager.syncKnowledgeAssetsByUAL(ual);
            // }

            return isSuccessful;
        } catch (error) {
            this.logger.warn(
                `Paranet sync: Failed to sync asset: ${ual} for paranet: ${paranetId}, error: ${error}`,
            );
            // TODO: increase retry count
            await this.repositoryModuleManager.incrementRetriesForUalAndParanetUal(ual, paranetUAL);

            return false;
        }
    }

    async syncMissedKAs(
        paranetUAL,
        paranetId,
        paranetNodesAccessPolicy,
        paranetRepository,
        operationId,
    ) {
        const missedParanetAssets =
            await this.repositoryModuleManager.getMissedParanetAssetsRecordsWithRetryCount(
                paranetUAL,
                PARANET_SYNC_RETRIES_LIMIT,
                PARANET_SYNC_RETRY_DELAY_MS,
            );

        const results = [];

        // Loop through missedParanetAssets in batches
        for (let i = 0; i < missedParanetAssets.length; i += PARANET_SYNC_KA_COUNT) {
            // Get the current batch
            const batch = missedParanetAssets.slice(i, i + PARANET_SYNC_KA_COUNT);

            // Map the batch to an array of promises
            const promises = batch.map((missedParanetAsset) => {
                const {
                    blockchain: knowledgeAssetBlockchain,
                    contract: knowledgeAssetStorageContract,
                    tokenId: knowledgeAssetTokenId,
                } = this.ualService.resolveUAL(missedParanetAsset.ual);

                return this.syncAsset(
                    missedParanetAsset.ual,
                    knowledgeAssetBlockchain,
                    knowledgeAssetStorageContract,
                    knowledgeAssetTokenId,
                    paranetUAL,
                    paranetId,
                    paranetNodesAccessPolicy,
                    paranetRepository,
                    operationId,
                );
            });

            // Await the promises in the current batch
            const batchResults = await Promise.all(promises);

            // Accumulate the results
            results.push(...batchResults);
        }

        const successfulCount = results.filter(Boolean).length;

        return [successfulCount, results.length - successfulCount];
    }

    async syncNewKAs(
        blockchain,
        startIndex,
        contractKaCount,
        paranetUAL,
        paranetId,
        // paranetNodesAccessPolicy,
        // paranetRepository,
        // operationId,
    ) {
        let i = Number(startIndex);

        // const results = [];
        while (i <= contractKaCount) {
            const nextKaArray =
                await this.blockchainModuleManager.getParanetKnowledgeCollectionsWithPagination(
                    blockchain,
                    paranetId,
                    i,
                    PARANET_SYNC_KA_COUNT,
                );

            if (nextKaArray.length === 0) {
                break;
            }

            i += nextKaArray.length;

            // const filteredKAs = [];
            // NOTE: This could also be processed in parallel if needed
            for (const knowledgeAssetId of nextKaArray) {
                const { knowledgeAssetStorageContract, tokenId: knowledgeAssetTokenId } =
                    await this.blockchainModuleManager.getParanetKnowledgeCollectionLocator(
                        blockchain,
                        knowledgeAssetId,
                    );

                const ual = this.ualService.deriveUAL(
                    blockchain,
                    knowledgeAssetStorageContract,
                    knowledgeAssetTokenId,
                );

                // TODO: can do these two queries in one and just get if asset exists in table
                const isAlreadySynced =
                    await this.repositoryModuleManager.paranetSyncedAssetRecordExists(ual);

                // Skip already synced KAs
                if (isAlreadySynced) {
                    continue;
                }

                // TODO: can do these two queries in one and just get if asset exists in table
                const isMissedAsset =
                    await this.repositoryModuleManager.missedParanetAssetRecordExists(
                        ual,
                        paranetUAL,
                    );

                // Skip missed KAs as they are synced in the other function
                if (isMissedAsset) {
                    continue;
                }

                await this.repositoryModuleManager.createParanetAssetRecord({
                    blockchainId: blockchain,
                    ual,
                    paranetUal: paranetUAL,
                });

                // so instead of pushing to filtered KAs and syncing
                // just add them to DB as missed and let the other loop catch them?

                // filteredKAs.push([
                //     ual,
                //     blockchain,
                //     knowledgeAssetStorageContract,
                //     knowledgeAssetTokenId,
                // ]);
            }

            // if (filteredKAs.length > 0) {
            //     const promises = filteredKAs.map(
            //         ([syncKAUal, syncKABlockchain, syncKAContract, syncKATokenId]) =>
            //             this.syncAsset(
            //                 syncKAUal,
            //                 syncKABlockchain,
            //                 syncKAContract,
            //                 syncKATokenId,
            //                 paranetUAL,
            //                 paranetId,
            //                 paranetNodesAccessPolicy,
            //                 paranetRepository,
            //                 operationId,
            //                 false,
            //             ),
            //     );

            //     const batchResults = await Promise.all(promises);
            //     results.push(...batchResults);
            // }
        }

        // const successfulCount = results.filter(Boolean).length;
        // return [successfulCount, results.length - successfulCount];
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
