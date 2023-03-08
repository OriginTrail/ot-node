import EpochCommand from '../../common/epoch-command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../../constants/constants.js';

class EpochCheckCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;
        this.tripleStoreService = ctx.tripleStoreService;

        this.errorType = ERROR_TYPE.COMMIT_PROOF.EPOCH_CHECK_ERROR;
    }

    async execute(command) {
        const { blockchain, agreementId, contract, tokenId, keyword, hashFunctionId, operationId } =
            command.data;

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
        );

        const agreementData = await this.blockchainModuleManager.getAgreementData(
            blockchain,
            agreementId,
        );
        const epoch = this.calculateCurrentEpoch(
            agreementData.startTime,
            agreementData.epochLength,
            blockchain,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_START,
            operationId,
            agreementId,
            epoch,
        );

        const assertionId =
            epoch === 0
                ? command.data.assertionId
                : await this.blockchainModuleManager.getLatestAssertionId(
                      blockchain,
                      contract,
                      tokenId,
                  );

        if (this.assetLifetimeExpired(agreementData, epoch)) {
            await this.handleExpiredAsset(agreementId, operationId, epoch);
            return EpochCommand.empty();
        }
        const assertionExists = await this.tripleStoreService.assertionExists(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            assertionId,
        );

        if (!assertionExists) {
            this.logger.trace(
                `Assertion with id: ${assertionId} not found in triple store. Not scheduling next epcoh checks.`,
            );
            return EpochCommand.empty();
        }

        const commitWindowOpen = await this.blockchainModuleManager.isCommitWindowOpen(
            blockchain,
            agreementId,
            epoch,
        );
        if (!commitWindowOpen) {
            this.logger.trace(
                `Commit window for agreement id: ${agreementId} is closed. Scheduling next epoch check.`,
            );
            await this.scheduleNextEpochCheck(
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                epoch,
                hashFunctionId,
                agreementData,
                operationId,
                assertionId,
            );
            return this.finishEpochCheckCommand(operationId, agreementId, epoch);
        }

        const identityId =
            command.data.identityId ??
            (await this.blockchainModuleManager.getIdentityId(blockchain));

        await this.commandExecutor.add({
            name: 'submitCommitCommand',
            sequence: [],
            delay: 0,
            period: 12 * 1000, // todo: get from blockchain / oracle
            retries: COMMAND_RETRIES.SUBMIT_COMMIT,
            data: { ...command.data, agreementData, identityId },
            transactional: false,
        });

        return this.finishEpochCheckCommand(operationId, agreementId, epoch);
    }

    finishEpochCheckCommand(operationId, agreementId, epoch) {
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_END,
            operationId,
            agreementId,
            epoch,
        );
        return EpochCommand.empty();
    }

    assetLifetimeExpired(agreementData, epoch) {
        return epoch >= agreementData.epochsNumber;
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'epochCheckCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default EpochCheckCommand;
