import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    GET_STATES,
    TRIPLE_STORE,
    PENDING_STORAGE_REPOSITORIES,
} from '../../../../constants/constants.js';

class LocalGetCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.config = ctx.config;
        this.operationService = ctx.getService;
        this.operationIdService = ctx.operationIdService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.paranetService = ctx.paranetService;
        this.ualService = ctx.ualService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.GET.GET_LOCAL_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, contract, tokenId, assertionId, state, paranetUAL } =
            command.data;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.GET.GET_LOCAL_START,
        );

        const response = {};

        if (paranetUAL) {
            const paranetRepository = this.paranetService.getParanetRepositoryName(paranetUAL);

            const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
            const syncedAssetRecord =
                await this.repositoryModuleManager.getParanetSyncedAssetRecordByUAL(ual);

            const nquads = await this.tripleStoreService.getAssertion(
                paranetRepository,
                syncedAssetRecord.publicAssertionId,
            );

            let privateNquads;
            if (syncedAssetRecord.privateAssertionId) {
                privateNquads = await this.tripleStoreService.getAssertion(
                    paranetRepository,
                    syncedAssetRecord.privateAssertionId,
                );
            }

            if (nquads?.length) {
                response.assertion = nquads;
                if (privateNquads?.length) {
                    response.privateAssertion = privateNquads;
                }
            } else {
                this.handleError(
                    operationId,
                    blockchain,
                    `Couldn't find locally asset with ${ual} in paranet ${paranetUAL}`,
                    this.errorType,
                );
            }

            await this.operationService.markOperationAsCompleted(
                operationId,
                blockchain,
                response,
                [
                    OPERATION_ID_STATUS.GET.GET_LOCAL_END,
                    OPERATION_ID_STATUS.GET.GET_END,
                    OPERATION_ID_STATUS.COMPLETED,
                ],
            );

            return Command.empty();
        }

        if (
            state !== GET_STATES.FINALIZED &&
            blockchain != null &&
            contract != null &&
            tokenId != null
        ) {
            for (const repository of [
                PENDING_STORAGE_REPOSITORIES.PRIVATE,
                PENDING_STORAGE_REPOSITORIES.PUBLIC,
            ]) {
                // eslint-disable-next-line no-await-in-loop
                const stateIsPending = await this.pendingStorageService.assetHasPendingState(
                    repository,
                    blockchain,
                    contract,
                    tokenId,
                    assertionId,
                );

                if (stateIsPending) {
                    // eslint-disable-next-line no-await-in-loop
                    const cachedAssertion = await this.pendingStorageService.getCachedAssertion(
                        repository,
                        blockchain,
                        contract,
                        tokenId,
                        assertionId,
                        operationId,
                    );

                    if (cachedAssertion?.public?.assertion?.length) {
                        response.assertion = cachedAssertion.public.assertion;
                        if (cachedAssertion?.private?.assertion?.length) {
                            response.privateAssertion = cachedAssertion.private.assertion;
                        }
                        break;
                    }
                }
            }
        }

        if (!response?.assertion?.length) {
            for (const repository of [
                TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
                TRIPLE_STORE.REPOSITORIES.PUBLIC_CURRENT,
                TRIPLE_STORE.REPOSITORIES.PRIVATE_HISTORY,
                TRIPLE_STORE.REPOSITORIES.PUBLIC_HISTORY,
            ]) {
                // eslint-disable-next-line no-await-in-loop
                response.assertion = await this.tripleStoreService.getAssertion(
                    repository,
                    assertionId,
                );
                if (response?.assertion?.length) break;
            }
        }

        if (response?.assertion?.length) {
            await this.operationService.markOperationAsCompleted(
                operationId,
                blockchain,
                response,
                [
                    OPERATION_ID_STATUS.GET.GET_LOCAL_END,
                    OPERATION_ID_STATUS.GET.GET_END,
                    OPERATION_ID_STATUS.COMPLETED,
                ],
            );

            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.GET.GET_LOCAL_END,
        );

        return this.continueSequence(command.data, command.sequence);
    }

    async handleError(operationId, blockchain, errorMessage, errorType) {
        await this.operationService.markOperationAsFailed(
            operationId,
            blockchain,
            errorMessage,
            errorType,
        );
    }

    /**
     * Builds default localGetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'localGetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default LocalGetCommand;
