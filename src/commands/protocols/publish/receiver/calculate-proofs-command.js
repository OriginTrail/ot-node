import Command from '../../../command.js';

class CalculateProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            keyword,
            hashingAlgorithm,
            serviceAgreement,
            epoch,
            agreementId,
            identityId,
        } = command.data;

        if (
            (await this.isEligibleForRewards(blockchain, agreementId, epoch, identityId)) ||
            !(await this.blockchainModuleManager.isProofWindowOpen(agreementId, epoch))
        ) {
            await this.scheduleNextEpochCheck(blockchain, agreementId, epoch, serviceAgreement);
        } else {
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

            await this.commandExecutor.add({
                name: 'submitProofsCommand',
                delay: 0,
                data: {
                    leaf,
                    proof,
                },
                transactional: false,
            });
        }
    }

    async isEligibleForRewards(blockchain, agreementId, epoch, identityId) {
        const commits = await this.blockchainModuleManager.getCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
        );

        const r0 = await this.blockchainModuleManager.getR0(blockchain);
        commits.slice(0, r0).forEach((commit) => {
            if (commit.identityId === identityId) {
                return true;
            }
        });

        return false;
    }

    async scheduleNextEpochCheck(blockchain, agreementId, epoch, serviceAgreement) {
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
