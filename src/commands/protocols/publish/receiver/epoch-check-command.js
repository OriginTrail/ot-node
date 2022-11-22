import { AGREEMENT_STATUS } from '../../../../constants/constants.js';
import Command from '../../../command.js';

class EpochCheckCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.commandExecutor = ctx.commandExecutor;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
    }

    async execute(command) {
        const {
            blockchain,
            agreementId,
            contract,
            tokenId,
            keyword,
            epoch,
            hashFunctionId,
            operationId,
            serviceAgreement,
        } = command.data;

        this.logger.trace(
            `Started ${command.name} for agreement id: ${agreementId} ` +
                `contract: ${contract}, token id: ${tokenId}, keyword: ${keyword}, ` +
                `hash function id: ${hashFunctionId}`,
        );

        if (this.assetLifetimeExpired(serviceAgreement, epoch)) {
            this.logger.trace(`Asset lifetime for agreement id: ${agreementId} has expired.`);
            await this.repositoryModuleManager.updateOperationAgreementStatus(
                operationId,
                agreementId,
                AGREEMENT_STATUS.EXPIRED,
            );
            return Command.empty();
        }

        // Time on ganache isn't increasing without txs,
        // needed for commit-proof phase to work using local blockchain
        await this.blockchainModuleManager.increaseGanacheTime(30);

        const commitWindowOpen = await this.blockchainModuleManager.isCommitWindowOpen(
            blockchain,
            agreementId,
            epoch,
        );

        if (!commitWindowOpen) {
            this.logger.trace(
                `Commit window for for agreement id: ${agreementId} is closed. Scheduling next epoch check.`,
            );
            await this.scheduleNextEpochCheck(
                blockchain,
                agreementId,
                contract,
                tokenId,
                epoch,
                serviceAgreement,
            );
            return Command.empty();
        }

        const identityId =
            command.data.identityId ??
            (await this.blockchainModuleManager.getIdentityId(blockchain));

        const r0 = await this.blockchainModuleManager.getR0(blockchain);

        await this.commandExecutor.add({
            name: 'submitCommitCommand',
            sequence: [],
            delay: 0,
            retries: r0,
            data: { ...command.data, serviceAgreement, identityId },
            transactional: false,
        });

        return Command.empty();
    }

    async getPreviousIdentityIdAndRank(blockchain, commits, keyword, hashFunctionId) {
        const score = await this.serviceAgreementService.calculateScore(
            blockchain,
            keyword,
            hashFunctionId,
        );

        this.logger.trace(`Commit submissions score: ${score}`);

        for (let i = commits.length - 1; i >= 0; i -= 1) {
            if (commits[i].score > score) {
                return {
                    prevIdentityId: commits[i].identityId,
                    rank: i + 1,
                };
            }
        }

        return { prevIdentityId: 0, rank: 0 };
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
            delay: nextEpochStartTime - Math.floor(Date.now() / 1000), // Add randomness?
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

    assetLifetimeExpired(serviceAgreement, epoch) {
        return serviceAgreement.epochsNumber < epoch;
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to execute epoch check command: error: ${error.message}`);

        await this.scheduleNextEpochCheck(
            command.data.blockchain,
            command.data.agreementId,
            command.data.contract,
            command.data.tokenId,
            command.data.keyword,
            command.data.epoch,
            command.data.hashFunctionId,
            command.data.serviceAgreement,
        );

        return Command.empty();
    }

    /**
     * Builds default handleStoreInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'epochCheckCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default EpochCheckCommand;
