/* eslint-disable no-unused-vars */
/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';
import Command from '../command.js';
import {
    ERROR_TYPE,
    PARANET_SYNC_FREQUENCY_MILLS,
    OPERATION_ID_STATUS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    PARANET_SYNC_PARAMETERS,
    TRIPLE_STORE_REPOSITORIES,
    PARANET_SYNC_KA_COUNT,
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
        const { blockchain, tokenId, operationId, paranetUAL, paranetId, paranetMetadata } =
            command.data;

        const paranetNodesAccessPolicy =
            PARANET_NODES_ACCESS_POLICIES[paranetMetadata.nodesAccessPolicy];

        this.logger.info(
            `Paranet sync: Starting paranet sync for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}`,
        );

        let contractKaCount = await this.blockchainModuleManager.getParanetKnowledgeAssetsCount(
            blockchain,
            paranetId,
        );
        contractKaCount = contractKaCount.toNumber();
        const cachedKaCount = (
            await this.repositoryModuleManager.getParanetKnowledgeAssetsCount(paranetId, blockchain)
        )[0].dataValues.ka_count;

        const cachedMissedKaCount =
            await this.repositoryModuleManager.getCountOfMissedAssetsOfParanet(paranetUAL);
        if (cachedKaCount + cachedMissedKaCount >= contractKaCount) {
            this.logger.info(
                `Paranet sync: KA count from contract and in DB is the same, nothing new to sync, for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}!`,
            );
            if (cachedMissedKaCount > 0) {
                this.logger.info(
                    `Paranet sync: Missed KA count is ${cachedMissedKaCount} syncing ${
                        cachedMissedKaCount > PARANET_SYNC_KA_COUNT
                            ? PARANET_SYNC_KA_COUNT
                            : cachedMissedKaCount
                    } assets, for paranet: ${paranetUAL}, operation ID: ${operationId}!`,
                );
                const missedParanetAssets =
                    await this.repositoryModuleManager.getMissedParanetAssetsRecords(
                        paranetUAL,
                        PARANET_SYNC_KA_COUNT,
                    );

                const promises = [];
                // It's array of keywords not tokenId
                // .map((ka) => ka.tokenId)
                missedParanetAssets.forEach((missedParanetAsset) => {
                    promises.push(
                        (async () => {
                            const { knowledgeAssetId } = missedParanetAsset;
                            this.logger.info(
                                `Paranet sync: Syncing missed token id: ${knowledgeAssetId} for ${paranetUAL} (${paranetId}) with operation id: ${operationId}`,
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
                            for (
                                let stateIndex = assertionIds.length - 2;
                                stateIndex >= 0;
                                stateIndex -= 1
                            ) {
                                isSuccessful =
                                    isSuccessful &&
                                    (await this.syncAsset(
                                        blockchain,
                                        knowledgeAssetStorageContract,
                                        kaTokenId,
                                        assertionIds,
                                        stateIndex,
                                        paranetId,
                                        tokenId,
                                        TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                                        false,
                                        // It should never delete as it never was in storage
                                        // But maybe will because this is unfinalized
                                        stateIndex === assertionIds.length - 2,
                                        paranetUAL,
                                        knowledgeAssetId,
                                        paranetNodesAccessPolicy,
                                        paranetMetadata,
                                    ));
                            }
                            // Then sync the last one, but put it in the current repo
                            isSuccessful =
                                isSuccessful &&
                                (await this.syncAsset(
                                    blockchain,
                                    knowledgeAssetStorageContract,
                                    kaTokenId,
                                    assertionIds,
                                    assertionIds.length - 1,
                                    paranetId,
                                    tokenId,
                                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                                    true,
                                    false,
                                    paranetUAL,
                                    knowledgeAssetId,
                                    paranetNodesAccessPolicy,
                                    paranetMetadata,
                                ));

                            if (isSuccessful) {
                                const ual = this.ualService.deriveUAL(
                                    blockchain,
                                    knowledgeAssetStorageContract,
                                    kaTokenId,
                                );
                                await this.repositoryModuleManager.removeMissedParanetAssetRecord(
                                    ual,
                                );
                            }

                            return isSuccessful;
                        })(),
                    ); // Immediately invoke the async function
                });

                const promisesResolution = await Promise.all(promises);

                const successfulCount = promisesResolution.reduce((count, value) => {
                    if (value.assertion) {
                        return count + 1;
                    }
                    return count;
                }, 0);

                if (successfulCount > 0) {
                    await this.repositoryModuleManager.updateParanetKaCount(
                        paranetId,
                        blockchain,
                        cachedKaCount + successfulCount,
                    );
                }
                return Command.repeat();
            }
            return Command.repeat();
        }

        this.logger.info(
            `Paranet sync: Syncing ${
                contractKaCount + cachedMissedKaCount - cachedKaCount
            } new assets for paranet: ${paranetUAL} (${paranetId}), operation ID: ${operationId}`,
        );
        // TODO: Rename i, should it be cachedKaCount + 1 as cachedKaCount is already in, but count is index
        const kaToUpdate = [];
        for (
            let i = cachedKaCount + cachedMissedKaCount;
            i <= contractKaCount;
            i += PARANET_SYNC_KA_COUNT
        ) {
            const nextKaArray =
                await this.blockchainModuleManager.getParanetKnowledgeAssetsWithPagination(
                    blockchain,
                    paranetId,
                    i,
                    PARANET_SYNC_KA_COUNT,
                );
            if (!nextKaArray.length) break;
            kaToUpdate.push(...nextKaArray);
        }

        const promises = [];
        // It's array of keywords not tokenId
        // .map((ka) => ka.tokenId)
        kaToUpdate.forEach((knowledgeAssetId) => {
            promises.push(
                (async () => {
                    this.logger.info(
                        `Paranet sync: Syncing token id: ${knowledgeAssetId} for ${paranetUAL} (${paranetId}) with operation id: ${operationId}`,
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
                    for (
                        let stateIndex = assertionIds.length - 2;
                        stateIndex >= 0;
                        stateIndex -= 1
                    ) {
                        isSuccessful =
                            isSuccessful &&
                            (await this.syncAsset(
                                blockchain,
                                knowledgeAssetStorageContract,
                                kaTokenId,
                                assertionIds,
                                stateIndex,
                                paranetId,
                                tokenId,
                                TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                                false,
                                // It should never delete as it never was in storage
                                // But maybe will because this is not finalized
                                stateIndex === assertionIds.length - 2,
                                paranetUAL,
                                knowledgeAssetId,
                                paranetNodesAccessPolicy,
                                paranetMetadata,
                            ));
                    }

                    // Then sync the last one, but put it in the current repo
                    isSuccessful =
                        isSuccessful &&
                        (await this.syncAsset(
                            blockchain,
                            knowledgeAssetStorageContract,
                            kaTokenId,
                            assertionIds,
                            assertionIds.length - 1,
                            paranetId,
                            tokenId,
                            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                            true,
                            false,
                            paranetUAL,
                            knowledgeAssetId,
                            paranetNodesAccessPolicy,
                            paranetMetadata,
                        ));

                    return isSuccessful;
                })(),
            ); // Immediately invoke the async function
        });

        const promisesResolution = await Promise.all(promises);

        const successfulCount = promisesResolution.reduce((count, value) => {
            if (value) {
                return count + 1;
            }
            return count;
        }, 0);

        await this.repositoryModuleManager.updateParanetKaCount(
            paranetId,
            blockchain,
            cachedKaCount + successfulCount,
        );
        return Command.repeat();
    }

    async syncAsset(
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
                await setTimeout(PARANET_SYNC_PARAMETERS.GET_RESULT_POLLING_INTERVAL_MILLIS);
                getResult = await this.operationIdService.getOperationIdRecord(operationId);
                attempt += 1;
            } while (
                attempt < PARANET_SYNC_PARAMETERS.GET_RESULT_POLLING_MAX_ATTEMPTS &&
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
