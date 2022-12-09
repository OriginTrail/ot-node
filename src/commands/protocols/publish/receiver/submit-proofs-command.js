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
            agreementData,
            epoch,
            agreementId,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            operationId,
            identityId,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
        );

        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
        );

        if (this.proofAlreadySubmitted(commits, identityId)) {
            this.logger.trace(
                `Proofs already submitted for agreement id: ${agreementId} and epoch: ${epoch}`,
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
            );
            return EpochCommand.empty();
        }
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_START,
            operationId,
            agreementId,
            epoch,
        );
        try {
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
        } catch (error) {
            this.logger.warn(error.message);
            return EpochCommand.retry();
        }

        this.logger.trace(
            `Successfully executed ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
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
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.SUBMIT_PROOFS_END,
            operationId,
            agreementId,
            epoch,
        );

        return EpochCommand.empty();
    }

    proofAlreadySubmitted(commits, myIdentity) {
        commits.forEach((commit) => {
            if (Number(commit.identityId) === myIdentity && Number(commit.score) === 0) {
                return true;
            }
        });
        return false;
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
