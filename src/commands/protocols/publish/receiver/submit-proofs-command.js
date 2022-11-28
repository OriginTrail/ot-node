import EpochCommand from '../../common/epoch-command.js';
import { OPERATION_ID_STATUS, ERROR_TYPE } from '../../../../constants/constants.js';

class SubmitProofsCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.operationIdService = ctx.operationIdService;

        this.errorType = ERROR_TYPE.SUBMIT_PROOFS_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            leaf,
            proof,
            serviceAgreement,
            epoch,
            agreementId,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            operationId,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_START,
            operationId,
            agreementId,
            epoch,
        );
        await this.blockchainModuleManager.sendProof(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            proof,
            leaf,
        );

        this.scheduleNextEpochCheck(
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

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_END,
            operationId,
            agreementId,
            epoch,
        );

        return EpochCommand.empty();
    }

    /**
     * Builds default submitProofsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'submitProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default SubmitProofsCommand;
