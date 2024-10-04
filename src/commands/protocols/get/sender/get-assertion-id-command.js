import Command from '../../../command.js';
import {
    ERROR_TYPE,
    GET_STATES,
    PENDING_STORAGE_REPOSITORIES,
    EVM_ZERO,
} from '../../../../constants/constants.js';

class GetAssertionIdCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;

        this.errorType = ERROR_TYPE.GET.GET_ASSERTION_ID_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { operationId, blockchain, contract, tokenId, state, hashFunctionId } = command.data;
        this.logger.info(
            `Getting assertion id for token id: ${tokenId}, contract: ${contract}, state: ${state}, hash function id: ${hashFunctionId}, operation id: ${operationId} on blockchain: ${blockchain}`,
        );
        let assertionId;
        if (!Object.values(GET_STATES).includes(state)) {
            if (state === EVM_ZERO.BYTES32) {
                await this.handleError(
                    operationId,
                    blockchain,
                    `The provided state: ${state}. State hash cannot be 0x0.`,
                    this.errorType,
                );

                return Command.empty();
            }

            let pendingState;
            pendingState = await this.pendingStorageService.getPendingState(
                PENDING_STORAGE_REPOSITORIES.PUBLIC,
                blockchain,
                contract,
                tokenId,
            );
            if (!pendingState) {
                pendingState = await this.blockchainModuleManager.getUnfinalizedAssertionId(
                    blockchain,
                    tokenId,
                );
            }

            if (
                state !== pendingState &&
                !(
                    await this.blockchainModuleManager.getAssertionIds(
                        blockchain,
                        contract,
                        tokenId,
                    )
                ).includes(state)
            ) {
                await this.handleError(
                    operationId,
                    blockchain,
                    `The provided state: ${state} does not exist on the ${blockchain} blockchain, ``within contract: ${contract}, for the Knowledge Asset with tokenId: ${tokenId}, operation id: ${operationId}.`,
                    this.errorType,
                );

                return Command.empty();
            }

            assertionId = state;
        } else {
            this.logger.debug(
                `Searching for latest assertion id on ${blockchain} on contract: ${contract} with tokenId: ${tokenId}, operation id: ${operationId}`,
            );

            const assertionIds = await this.blockchainModuleManager.getAssertionIds(
                blockchain,
                contract,
                tokenId,
            );

            const latestFinalizedAssertionId = assertionIds[assertionIds.length - 1];

            if (state === GET_STATES.LATEST) {
                let unfinalizedAssertionId;
                unfinalizedAssertionId = await this.pendingStorageService.getPendingState(
                    PENDING_STORAGE_REPOSITORIES.PUBLIC,
                    blockchain,
                    contract,
                    tokenId,
                );
                if (!unfinalizedAssertionId) {
                    unfinalizedAssertionId =
                        await this.blockchainModuleManager.getUnfinalizedAssertionId(
                            blockchain,
                            tokenId,
                        );
                }
                if (unfinalizedAssertionId !== EVM_ZERO.BYTES32) {
                    const updateCommitWindowOpen = await this.isUpdateCommitWindowOpen(
                        blockchain,
                        contract,
                        tokenId,
                        hashFunctionId,
                        assertionIds,
                    );
                    if (updateCommitWindowOpen) {
                        assertionId = unfinalizedAssertionId;
                        this.logger.warn(
                            `Commit update window open for tokenId: ${tokenId}, using unfinalized assertion id: ${assertionId} for operation id: ${operationId}`,
                        );
                    } else {
                        assertionId = latestFinalizedAssertionId;
                        this.logger.warn(
                            `Commit update window closed for tokenId: ${tokenId}, latest assertion id will be used instead of unfinalized for operation id: ${operationId}`,
                        );
                    }
                }
            }
            if (
                assertionId === null ||
                assertionId === EVM_ZERO.BYTES32 ||
                assertionId === undefined
            ) {
                assertionId = latestFinalizedAssertionId;
            }
        }
        this.logger.info(
            `Found assertion id: ${assertionId} for token id: ${tokenId}, contract: ${contract} on blockchain: ${blockchain} for operation id: ${operationId}`,
        );
        return this.continueSequence({ ...command.data, state, assertionId }, command.sequence);
    }

    async isUpdateCommitWindowOpen(blockchain, contract, tokenId, hashFunctionId, assertionIds) {
        const keyword = await this.ualService.calculateLocationKeyword(
            blockchain,
            contract,
            tokenId,
            assertionIds[0],
        );

        const agreementId = this.serviceAgreementService.generateId(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        );
        const latestStateIndex = assertionIds.length;

        let agreementData;
        agreementData = await this.repositoryModuleManager.getServiceAgreementRecord(agreementId);
        if (!agreementData || agreementData.scoreFunctionId === 0) {
            agreementData = await this.blockchainModuleManager.getAgreementData(
                blockchain,
                agreementId,
            );
        }

        if (!agreementData || agreementData.scoreFunctionId === 0) {
            this.logger.warn(
                `Unable to fetch agreement data in get assertion id command ${agreementId}, blockchain id: ${blockchain}`,
            );
            throw Error(`Unable to get agreement data`);
        }

        const epoch = await this.serviceAgreementService.calculateCurrentEpoch(
            agreementData.startTime,
            agreementData.epochLength,
            blockchain,
        );

        return this.blockchainModuleManager.isUpdateCommitWindowOpen(
            blockchain,
            agreementId,
            epoch,
            latestStateIndex,
        );
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
     * Builds default getStateIdConditionalCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getAssertionIdCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetAssertionIdCommand;
