/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';
import Command from '../command.js';
import {
    ASSET_SYNC_COMMAND_FREQUENCY_MILLIS,
    CONTENT_ASSET_HASH_FUNCTION_ID,
    OPERATION_STATUS,
    OPERATION_ID_STATUS,
    TRIPLE_STORE_REPOSITORIES,
} from '../../constants/constants.js';

const GET_RESULT_POLLING_INTERVAL_MILLIS = 2 * 1000;
const GET_RESULT_POLLING_MAX_ATTEMPTS = 10;
class AssetSyncCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.commandExecutor = ctx.commandExecutor;
        this.ualService = ctx.ualService;
        this.serviceAgreementService = ctx.serviceAgreementService;
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

        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            const contracts =
                this.blockchainModuleManager.getAssetStorageContractAddresses(blockchain);

            for (const contract of contracts) {
                const latestTokenId = Number(
                    await this.blockchainModuleManager.getLatestTokenId(blockchain, contract),
                );

                const { token_id: latestSyncedTokenId, state_index: latestSyncedStateIndex } =
                    await this.repositoryModuleManager.getLatestSyncedAsset(blockchain, contract);

                for (let tokenId = latestSyncedTokenId; tokenId < latestTokenId; tokenId += 1) {
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
                        const assertionId = assertionIds[stateIndex];

                        const operationId = await this.operationIdService.generateOperationId(
                            OPERATION_ID_STATUS.GET.GET_START,
                        );

                        await this.operationIdService.updateOperationIdStatus(
                            operationId,
                            OPERATION_ID_STATUS.GET.GET_INIT_START,
                        );

                        await this.repositoryModuleManager.updateAssetSyncRecord(
                            blockchain,
                            contract,
                            tokenId,
                            stateIndex,
                            OPERATION_STATUS.IN_PROGRESS,
                        );

                        await this.repositoryModuleManager.createOperationRecord(
                            this.getService.getOperationName(),
                            operationId,
                            OPERATION_STATUS.IN_PROGRESS,
                        );

                        const id = this.ualService.deriveUAL(blockchain, contract, tokenId);

                        // TODO: to be defined (waiting for historical GET PR)
                        const state = stateIndex;
                        const hashFunctionId = CONTENT_ASSET_HASH_FUNCTION_ID;

                        this.logger.info(
                            `Get for ${id} with operation id ${operationId} initiated.`,
                        );

                        await this.commandExecutor.add({
                            name: 'networkGetCommand',
                            sequence: [],
                            delay: 0,
                            data: {
                                operationId,
                                id,
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
                            await setTimeout(GET_RESULT_POLLING_INTERVAL_MILLIS);

                            getResult = await this.operationIdService.getCachedOperationIdData(
                                operationId,
                            );
                            attempt += 1;
                        } while (
                            attempt < GET_RESULT_POLLING_MAX_ATTEMPTS &&
                            getResult.status !== OPERATION_ID_STATUS.FAILED &&
                            getResult.status !== OPERATION_ID_STATUS.COMPLETED
                        );

                        if (getResult.assertion) {
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
                            const agreementData =
                                await this.blockchainModuleManager.getAgreementData(
                                    blockchain,
                                    agreementId,
                                );

                            const agreementEndTime =
                                agreementData.startTime +
                                agreementData.epochsNumber * agreementData.epochLength;
                            await this.tripleStoreService.localStoreAsset(
                                stateIndex === assertionIds.length - 1
                                    ? TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT
                                    : TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                                assertionId,
                                getResult.assertion,
                                blockchain,
                                contract,
                                tokenId,
                                agreementData.startTime,
                                agreementEndTime,
                                keyword,
                            );
                        }

                        await this.repositoryModuleManager.updateAssetSyncRecord(
                            blockchain,
                            contract,
                            tokenId,
                            stateIndex,
                            getResult.status,
                        );
                    }
                }
            }
        }

        return Command.repeat();
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
            period: ASSET_SYNC_COMMAND_FREQUENCY_MILLIS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default AssetSyncCommand;
