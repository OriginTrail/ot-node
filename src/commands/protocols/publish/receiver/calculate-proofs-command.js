import EpochCommand from '../../common/epoch-command.js';
import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
} from '../../../../constants/constants.js';

class CalculateProofsCommand extends EpochCommand {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.operationIdService = ctx.operationIdService;
        this.dataService = ctx.dataService;
        this.errorType = ERROR_TYPE.COMMIT_PROOF.CALCULATE_PROOFS_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            agreementData,
            agreementId,
            identityId,
            operationId,
        } = command.data;
        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );
        const stateIndex = assertionIds.length - 1;
        const assertionId = assertionIds[stateIndex];

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `blockchain:${blockchain}, contract: ${contract}, token id: ${tokenId}, ` +
                `keyword: ${keyword}, hash function id: ${hashFunctionId} and stateIndex: ${stateIndex}`,
        );

        const epoch = await this.calculateCurrentEpoch(
            agreementData.startTime,
            agreementData.epochLength,
            blockchain,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_START,
            operationId,
            agreementId,
            epoch,
        );

        if (
            !(await this.isEligibleForRewards(
                blockchain,
                agreementId,
                epoch,
                identityId,
                stateIndex,
            ))
        ) {
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

            return EpochCommand.empty();
        }

        this.logger.trace(`Calculating proofs for agreement id : ${agreementId}`);
        const { challenge } = await this.blockchainModuleManager.getChallenge(
            blockchain,
            contract,
            tokenId,
            epoch,
        );

        const nquads = await this.tripleStoreService.localGet(assertionId);

        if (!nquads.length) {
            this.logger.trace(
                `Assertion with id: ${assertionId} not found in triple store. Not scheduling next epcoh checks.`,
            );
            return EpochCommand.empty();
        }

        const { leaf, proof } = this.validationModuleManager.getMerkleProof(
            nquads,
            Number(challenge),
        );

        await this.commandExecutor.add({
            name: 'submitProofsCommand',
            sequence: [],
            delay: 0,
            data: {
                ...command.data,
                leaf,
                proof,
                stateIndex,
            },
            period: 12 * 1000, // todo: get from blockchain / oracle
            retries: COMMAND_RETRIES.SUBMIT_PROOFS,
            transactional: false,
        });

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_END,
            operationId,
            agreementId,
            epoch,
        );
        return EpochCommand.empty();
    }

    async isEligibleForRewards(blockchain, agreementId, epoch, identityId, stateIndex) {
        const r0 = await this.blockchainModuleManager.getR0(blockchain);

        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
        );
        for (let i = 0; i < Math.min(r0, commits.length); i += 1) {
            if (Number(commits[i].identityId) === identityId) {
                this.logger.trace(`Node is eligible for rewards for agreement id: ${agreementId}`);

                return true;
            }
        }

        this.logger.trace(`Node is not eligible for rewards for agreement id: ${agreementId}`);

        return false;
    }

    /**
     * Builds default calculateProofsCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'calculateProofsCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default CalculateProofsCommand;
