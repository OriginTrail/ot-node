import EpochCommand from '../../common/epoch-command.js';
import {
    AGREEMENT_STATUS,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
} from '../../../../constants/constants.js';

class EpochCheckCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.EPOCH_CHECK_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            agreementId,
            contract,
            tokenId,
            keyword,
            epoch,
            hashFunctionId,
            operationId,
            serviceAgreement,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.EPOCH_CHECK_START,
            operationId,
            agreementId,
            epoch,
        );

        if (this.assetLifetimeExpired(serviceAgreement, epoch)) {
            this.logger.trace(`Asset lifetime for agreement id: ${agreementId} has expired.`);
            await this.repositoryModuleManager.updateOperationAgreementStatus(
                operationId,
                agreementId,
                AGREEMENT_STATUS.EXPIRED,
            );
            return this.finishEpochCheckCommand(operationId, agreementId, epoch);
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
                serviceAgreement,
                operationId,
            );
            return this.finishEpochCheckCommand(operationId, agreementId, epoch);
        }

        const identityId =
            command.data.identityId ??
            (await this.blockchainModuleManager.getIdentityId(blockchain));

        const r0 = await this.blockchainModuleManager.getR0(blockchain);

        await this.commandExecutor.add({
            name: 'submitCommitCommand',
            sequence: [],
            delay: 0,
            retries: r0,
            data: { ...command.data, serviceAgreement, identityId },
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

    assetLifetimeExpired(serviceAgreement, epoch) {
        return serviceAgreement.epochsNumber < epoch;
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
