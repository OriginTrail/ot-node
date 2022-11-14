import Command from '../../../command.js';

class SubmitProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);

        this.blockchainModuleManager = ctx.blockchainModuleManager;
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
            hashingAlgorithm,
        } = command.data;

        // todo this method will return next epoch start time - once updated in dkg-evm-module, update sendProof method in blockchain module
        await this.blockchainModuleManager.sendProof(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashingAlgorithm,
            epoch,
            proof,
            leaf,
        );

        // todo get start time from blockchain
        const nextEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * epoch;

        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: nextEpochStartTime - Date.now(),
            data: {
                blockchain,
                agreementId,
                epoch: epoch + 1,
                serviceAgreement,
            },
            transactional: false,
        });

        return Command.empty();
    }

    /**
     * Builds default handleStoreInitCommand
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
