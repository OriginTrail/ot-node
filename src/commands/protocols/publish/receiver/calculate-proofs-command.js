import Command from '../../../command.js';

class CalculateProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.validationModuleManager = ctx.validationModuleManager;
    }

    async execute(command) {
        const { proofPhaseStartTime, blockchain, contract, tokenId, keyword, hashingAlgorithm } =
            command.data;

        // todo add check did i won - if not next epoch check command, yes - calculate and send proof
        // todo check proof window is open? retry couple of times with delay 5s
        const { assertionId, challenge } = await this.blockchainModuleManager.getChallenge(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashingAlgorithm,
        );

        const { leaf, proof } = await this.validationModuleManager.getMerkleProof(
            await this.tripleStoreModuleManager.get(assertionId),
            challenge,
        );

        // todo remove delay
        await this.commandExecutor.add({
            name: 'submitProofsCommand',
            delay: proofPhaseStartTime - Date.now(),
            data: {
                leaf,
                proof,
            },
            transactional: false,
        });
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
