import { setTimeout } from 'timers/promises';
import Command from '../../command.js';
import {
    COMMAND_RETRIES,
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    OPERATION_STATUS,
    SIMPLE_ASSET_SYNC_PARAMETERS,
} from '../../../constants/constants.js';

class SimpleAssetSyncCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;
        this.operationIdService = ctx.operationIdService;
        this.getService = ctx.getService;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.SIMPLE_ASSET_SYNC_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            operationId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            assertionId,
            stateIndex,
        } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.COMMIT_PROOF.SIMPLE_ASSET_SYNC_START,
        );

        this.logger.info(
            `[SIMPLE_ASSET_SYNC] (${operationId}): Started command for the ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, ` +
                `Retry number: ${COMMAND_RETRIES.SIMPLE_ASSET_SYNC - command.retries + 1}`,
        );

        try {
            this.logger.debug(
                `[SIMPLE_ASSET_SYNC] (${operationId}): Fetching Knowledge Asset from the network for the ` +
                    `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                    `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                    `State Index: ${stateIndex}, Operation ID: ${operationId}`,
            );

            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

            const getOperationId = await this.operationIdService.generateOperationId(
                OPERATION_ID_STATUS.GET.GET_START,
            );

            await Promise.all([
                this.operationIdService.updateOperationIdStatus(
                    getOperationId,
                    blockchain,
                    OPERATION_ID_STATUS.GET.GET_INIT_START,
                ),
                this.repositoryModuleManager.createOperationRecord(
                    this.getService.getOperationName(),
                    getOperationId,
                    OPERATION_STATUS.IN_PROGRESS,
                ),
            ]);

            await this.commandExecutor.add({
                name: 'networkGetCommand',
                sequence: [],
                delay: 0,
                data: {
                    getOperationId,
                    id: ual,
                    blockchain,
                    contract,
                    tokenId,
                    state: assertionId,
                    hashFunctionId,
                    assertionId,
                    stateIndex,
                },
                transactional: false,
            });

            await this.operationIdService.updateOperationIdStatus(
                getOperationId,
                blockchain,
                OPERATION_ID_STATUS.GET.GET_INIT_END,
            );

            let attempt = 0;
            let getResult;
            do {
                // eslint-disable-next-line no-await-in-loop
                await setTimeout(SIMPLE_ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_INTERVAL_MILLIS);

                // eslint-disable-next-line no-await-in-loop
                getResult = await this.operationIdService.getOperationIdRecord(getOperationId);
                attempt += 1;
            } while (
                attempt < SIMPLE_ASSET_SYNC_PARAMETERS.GET_RESULT_POLLING_MAX_ATTEMPTS &&
                getResult?.status !== OPERATION_ID_STATUS.FAILED &&
                getResult?.status !== OPERATION_ID_STATUS.COMPLETED
            );
        } catch (error) {
            this.logger.warn(
                `[SIMPLE_ASSET_SYNC] (${operationId}): Unable to sync Knowledge Asset for the ` +
                    `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                    `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                    `State Index: ${stateIndex}, Operation ID: ${operationId}, `,
            );

            return Command.retry();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.COMMIT_PROOF.SIMPLE_ASSET_SYNC_END,
        );

        this.logger.info(
            `[SIMPLE_ASSET_SYNC] (${operationId}): Successfully executed command for the ` +
                `Blockchain: ${blockchain}, Contract: ${contract}, Token ID: ${tokenId}, ` +
                `Keyword: ${keyword}, Hash function ID: ${hashFunctionId}, Epoch: ${epoch}, ` +
                `State Index: ${stateIndex}, Operation ID: ${operationId}, `,
        );

        return this.continueSequence(command.data, command.sequence, {
            retries: COMMAND_RETRIES.SUBMIT_COMMIT,
        });
    }

    async retryFinished(command) {
        const { blockchain, contract, tokenId, operationId } = command.data;
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        await this.handleError(
            operationId,
            blockchain,
            `Max retry count for the ${command.name} reached! ` +
                `Unable to sync Knowledge Asset on the ${blockchain} blockchain with the UAL: ${ual}`,
            this.errorType,
            true,
        );
    }

    /**
     * Builds default simpleAssetSyncCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'simpleAssetSyncCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SimpleAssetSyncCommand;
