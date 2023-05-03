import {
    OPERATION_ID_STATUS,
    ERROR_TYPE,
    COMMAND_RETRIES,
    TRIPLE_STORE_REPOSITORIES,
} from '../../../../constants/constants.js';
import Command from '../../../command.js';

class CalculateProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.operationIdService = ctx.operationIdService;
        this.errorType = ERROR_TYPE.COMMIT_PROOF.CALCULATE_PROOFS_ERROR;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            agreementId,
            operationId,
            epoch,
            assertionId,
            stateIndex,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `blockchain:${blockchain}, contract: ${contract}, token id: ${tokenId}, ` +
                `keyword: ${keyword}, hash function id: ${hashFunctionId} and stateIndex: ${stateIndex}`,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_START,
            operationId,
            agreementId,
            epoch,
        );

        this.logger.trace(`Calculating proofs for agreement id : ${agreementId}`);
        const { challenge } = await this.blockchainModuleManager.getChallenge(
            blockchain,
            contract,
            tokenId,
            epoch,
            stateIndex,
        );

        const assertion = await this.tripleStoreService.getAssertion(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            assertionId,
        );

        if (!assertion.length) {
            this.logger.trace(`Assertion with id: ${assertionId} not found in triple store.`);
            return Command.empty();
        }

        const { leaf, proof } = this.validationModuleManager.getMerkleProof(
            assertion,
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
            },
            retries: COMMAND_RETRIES.SUBMIT_PROOFS,
            transactional: false,
        });

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.COMMIT_PROOF.CALCULATE_PROOFS_END,
            operationId,
            agreementId,
            epoch,
        );
        return Command.empty();
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
