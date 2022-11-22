import Command from '../../../command.js';

class CalculateProofsCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
    }

    async execute(command) {
        const {
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            serviceAgreement,
            epoch,
            agreementId,
            identityId,
            proofWindowStartTime,
        } = command.data;

        this.logger.trace(
            `Started calculate proofs command for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
        );

        if (
            !(await this.isEligibleForRewards(blockchain, agreementId, epoch, identityId)) ||
            (await this.blockchainModuleManager.isProofWindowOpen(blockchain, agreementId, epoch))
        ) {
            this.logger.trace(
                `Either not eligible for reward or proof phase has ` +
                    `already started (agreementId: ${agreementId}). Scheduling ` +
                    `next epoch check...`,
            );

            await this.scheduleNextEpochCheck(
                blockchain,
                agreementId,
                contract,
                tokenId,
                keyword,
                epoch,
                hashFunctionId,
                serviceAgreement,
            );

            return Command.empty();
        }

        this.logger.trace(
            `Proof window hasn't been opened yet and node is eligible for rewards. ` +
                `Calculating proofs for agreement id : ${agreementId}`,
        );
        const { assertionId, challenge } = await this.blockchainModuleManager.getChallenge(
            blockchain,
            contract,
            tokenId,
            epoch,
        );

        const nQuads = (await this.tripleStoreModuleManager.get(assertionId)).split('\n');

        const { leaf, proof } = this.validationModuleManager.getMerkleProof(nQuads, challenge);

        const proofWindowDurationPerc =
            await this.blockchainModuleManager.getProofWindowDurationPerc();
        const proofWindowDuration = Math.floor(
            (serviceAgreement.epochLength * proofWindowDurationPerc) / 100,
        );

        const endOffset = 30; // 30 sec

        const timeNow = Math.floor(Date.now() / 1000);
        const delay = this.serviceAgreementService.randomIntFromInterval(
            proofWindowStartTime - timeNow,
            proofWindowStartTime + proofWindowDuration - timeNow - endOffset,
        );

        await this.commandExecutor.add({
            name: 'submitProofsCommand',
            delay,
            data: {
                ...command.data,
                leaf,
                proof,
            },
            transactional: false,
        });
    }

    async isEligibleForRewards(blockchain, agreementId, epoch, identityId) {
        const commits = await this.blockchainModuleManager.getCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
        );

        const r0 = await this.blockchainModuleManager.getR0(blockchain);

        for (let i = 0; i < r0; i += 1) {
            if (commits[i].identityId === identityId) {
                this.logger.trace(`Node is eligible for rewards for agreement id: ${agreementId}`);

                return true;
            }
        }

        this.logger.trace(`Node is not eligible for rewards for agreement id: ${agreementId}`);

        return false;
    }

    async scheduleNextEpochCheck(
        blockchain,
        agreementId,
        contract,
        tokenId,
        keyword,
        epoch,
        hashFunctionId,
        serviceAgreement,
    ) {
        const nextEpochStartTime =
            serviceAgreement.startTime + serviceAgreement.epochLength * (epoch + 1);

        await this.commandExecutor.add({
            name: 'epochCheckCommand',
            sequence: [],
            delay: nextEpochStartTime - Math.floor(Date.now() / 1000),
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
