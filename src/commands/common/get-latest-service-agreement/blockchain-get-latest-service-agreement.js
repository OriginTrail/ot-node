import Command from '../../command.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    EXPECTED_TRANSACTION_ERRORS,
    GET_LATEST_SERVICE_AGREEMENT_FREQUENCY_MILLS,
    SERVICE_AGREEMENT_SOURCES,
} from '../../../constants/constants.js';

const BATCH_SIZE = 50;

class BlockchainGetLatestServiceAgreement extends Command {
    constructor(ctx) {
        super(ctx);
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.serviceAgreementService = ctx.serviceAgreementService;
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
        this.logger.info(
            `Get latest service agreement: Starting get latest service agreement command for blockchain: ${blockchain}`,
        );
        let latestBlockchainTokenId;
        try {
            latestBlockchainTokenId = await this.blockchainModuleManager.getLatestTokenId(
                blockchain,
                contract,
            );
        } catch (error) {
            if (error.message.includes(EXPECTED_TRANSACTION_ERRORS.NO_MINTED_ASSETS)) {
                this.logger.info(
                    `Get latest service agreement: No minted assets on blockchain: ${blockchain}`,
                );
                return;
            }
            throw error;
        }

        const latestDbTokenId =
            (await this.repositoryModuleManager.getLatestServiceAgreementTokenId(blockchain)) ?? 0;

        this.logger.debug(
            `Get latest service agreement: Latest token id on chain: ${latestBlockchainTokenId}, latest token id in database: ${latestDbTokenId} on blockchain: ${blockchain}`,
        );

        const missingTokenIds = Array.from(
            { length: latestBlockchainTokenId - latestDbTokenId },
            (_, index) => latestDbTokenId + index + 1,
        );
        this.logger.debug(
            `Get latest service agreement: Found ${missingTokenIds.length} on blockchain: ${blockchain}`,
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
        this.logger.debug(
            `Get latest service agreement: Successfully fetched ${missingTokenIds.length} on blockchain: ${blockchain}`,
        );
    }

    async getAgreementDataForToken(
        tokenId,
        blockchain,
        contract,
        hashFunctionId = CONTENT_ASSET_HASH_FUNCTION_ID,
    ) {
        this.logger.debug(
            `Get latest service agreement: Getting agreement data for token id: ${tokenId} on blockchain: ${blockchain}`,
        );
        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );
        const keyword = await this.ualService.calculateLocationKeyword(
            blockchain,
            contract,
            tokenId,
            assertionIds[0],
        );
        const agreementId = await this.serviceAgreementService.generateId(
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
     * @param error
     */
    async recover() {
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
