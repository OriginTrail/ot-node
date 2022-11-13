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

        const { assertionId, challenge } = await Promise.all([
            this.blockchainModuleManager.getChallenge(
                blockchain,
                contract,
                tokenId,
                keyword,
                hashingAlgorithm,
            ),
            this.blockchainModuleManager.getLatestCommitHash(contract, tokenId),
        ]);

        const { leaf, proof } = await this.validationModuleManager.getMerkleProof(
            await this.tripleStoreModuleManager.get(assertionId),
            challenge,
        );

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
