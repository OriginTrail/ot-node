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
            hashFunctionId,
        } = command.data;

        this.logger.trace(
            `Started submit proofs command for agreement id: ${agreementId} contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, hash function id: ${hashFunctionId}`,
        );

        const nextEpochStartTime = await this.blockchainModuleManager.sendProof(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            epoch,
            proof,
            leaf,
        );

        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: nextEpochStartTime - Date.now(),
            data: {
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                epoch: epoch + 1,
                hashFunctionId,
                serviceAgreement,
            },
            transactional: false,
        });

        return Command.empty();
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
