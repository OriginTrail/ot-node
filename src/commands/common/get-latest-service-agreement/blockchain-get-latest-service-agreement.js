import Command from '../../command.js';
import {
    GET_LATEST_SERVICE_AGREEMENT_FREQUENCY_MILLS,
    SERVICE_AGREEMENT_SOURCES,
} from '../../../constants/constants.js';

const BATCH_SIZE = 50;

class BlockchainGetLatestServiceAgreement extends Command {
    constructor(ctx) {
        super(ctx);
        this.serviceAgreementService = ctx.serviceAgreementService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.ualService = ctx.ualService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { blockchain } = command.data;

        const assetStorageContractAddresses =
            this.blockchainModuleManager.getAssetStorageContractAddresses(blockchain);

        await Promise.all(
            assetStorageContractAddresses.map((contract) =>
                this.updateAgreementDataForAssetContract(contract, blockchain),
            ),
        );

        return Command.repeat();
    }

    async updateAgreementDataForAssetContract(contract, blockchain) {
        const latestBlockchainTokenId = await this.blockchainModuleManager.getLatestTokenId(
            blockchain,
            contract,
        );
        const latestDbTokenId = await this.repositoryModuleManager.getLatestServiceAgreementTokenId(
            blockchain,
        );

        const missingTokenIds = Array.from(
            { length: latestBlockchainTokenId - latestDbTokenId },
            (_, index) => latestDbTokenId + index,
        );

        let batchNumber = 0;
        while (batchNumber * BATCH_SIZE < missingTokenIds.length) {
            const promises = [];
            for (
                let i = batchNumber * BATCH_SIZE;
                i < missingTokenIds.length && i < (batchNumber + 1) * BATCH_SIZE;
                i += 1
            ) {
                const tokenIdToBeFetched = missingTokenIds[i];
                promises.push(
                    this.getAgreementDataForToken(tokenIdToBeFetched, blockchain, contract),
                );
            }

            // eslint-disable-next-line no-await-in-loop
            const missingAgreements = await Promise.all(promises);

            // eslint-disable-next-line no-await-in-loop
            await this.repositoryModuleManager.bulkCreateServiceAgreementRecords(
                missingAgreements.filter((agreement) => agreement != null),
            );
            batchNumber += 1;
        }
    }

    async getAgreementDataForToken(tokenId, blockchain, contract, hashFunctionId) {
        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );

        const keyword = this.ualService.calculateLocationKeyword(
            blockchain,
            contract,
            tokenId,
            assertionIds[0],
        );

        const agreementId = this.serviceAgreementService.generateId(
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        );

        const agreementData = await this.blockchainModuleManager.getAgreementData(
            blockchain,
            agreementId,
        );

        if (!agreementData) {
            this.logger.warn(
                `Unable to fetch agreement data while processing asset created event for agreement id: ${agreementId}, blockchain id: ${blockchain}`,
            );
        }

        const latestStateIndex = assertionIds.length - 1;

        return {
            blockchainId: blockchain,
            assetStorageContractAddress: contract,
            tokenId,
            agreementId,
            startTime: agreementData.startTime,
            epochsNumber: agreementData.epochsNumber,
            epochLength: agreementData.epochLength,
            scoreFunctionId: agreementData.scoreFunctionId,
            stateIndex: latestStateIndex,
            assertionId: assertionIds[latestStateIndex],
            hashFunctionId,
            keyword,
            proofWindowOffsetPerc: agreementData.proofWindowOffsetPerc,
            dataSource: SERVICE_AGREEMENT_SOURCES.NODE,
        };
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command) {
        this.logger.warn(`Failed to execute ${command.name}. Error: ${command.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'blockchainGetLatestServiceAgreement',
            data: {},
            period: GET_LATEST_SERVICE_AGREEMENT_FREQUENCY_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default BlockchainGetLatestServiceAgreement;
