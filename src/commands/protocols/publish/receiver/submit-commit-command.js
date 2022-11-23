import Command from '../../../command.js';
import { OPERATION_ID_STATUS } from '../../../../constants/constants.js';

class SubmitCommitCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.operationIdService = ctx.operationIdService;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            prevIdentityId,
            serviceAgreement,
            operationId,
            agreementId,
        } = command.data;
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_START,
            operationId,
            agreementId,
            epoch,
        );
        const proofPhaseStartTime = await this.blockchainModuleManager.submitCommit(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            prevIdentityId,
        );

        const endOffset = 30; // 30 sec

        const proofWindowDurationPerc =
            await this.blockchainModuleManager.getProofWindowDurationPerc();
        const proofWindowDuration = Math.floor(
            (serviceAgreement.epochLength * proofWindowDurationPerc) / 100,
        );
        const timeNow = Math.floor(Date.now() / 1000);
        const delay = this.serviceAgreementService.randomIntFromInterval(
            0,
            proofWindowDuration - (timeNow - proofPhaseStartTime) - endOffset,
        );

        await this.commandExecutor.add({
            name: 'calculateProofsCommand',
            delay,
            data: command.data,
            transactional: false,
        });

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_COMMIT_END,
            operationId,
            agreementId,
            epoch,
        );

        return Command.empty();
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitCommitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitCommitCommand;
