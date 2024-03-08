import BaseMigration from './base-migration.js';
import { SERVICE_AGREEMENT_SOURCES } from '../constants/constants.js';

const BATCH_SIZE = 50;
const GNOSIS_MAINNET_CHAIN_ID = 'gnosis:100';
const GNOSIS_MAINNET_ASSET_STORAGE_CONTRACT_ADDRESS = '0xf81a8c0008de2dcdb73366cf78f2b178616d11dd';

class GetOldServiceAgreementsMigration extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        repositoryModuleManager,
        blockchainModuleManager,
        serviceAgreementService,
    ) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.blockchainModuleManager = blockchainModuleManager;
        this.serviceAgreementService = serviceAgreementService;
    }

    async executeMigration() {
        const blockchainId = this.blockchainModuleManager
            .getImplementationNames()
            .find((s) => s === GNOSIS_MAINNET_CHAIN_ID);

        if (blockchainId) {
            const contract = GNOSIS_MAINNET_ASSET_STORAGE_CONTRACT_ADDRESS;

            const existingTokenIds =
                await this.repositoryModuleManager.getServiceAgreementsTokenIds(0, blockchainId);

            const latestTokenId = Number(
                await this.blockchainModuleManager.getLatestTokenId(blockchainId, contract),
            );

            const missingTokenIds = [];
            let expectedTokenId = 0;
            existingTokenIds.forEach((serviceAgreement) => {
                while (serviceAgreement.tokenId > expectedTokenId) {
                    missingTokenIds.push(expectedTokenId);
                    expectedTokenId += 1;
                }
                expectedTokenId += 1;
            });

            for (
                let i = (existingTokenIds[existingTokenIds.length - 1] ?? -1) + 1;
                i <= latestTokenId;
                i += 1
            ) {
                missingTokenIds.push(i);
            }

            let batchNumber = 0;
            // Check < or <= condition
            while (batchNumber * BATCH_SIZE < missingTokenIds.length) {
                const promises = [];
                for (
                    let i = batchNumber * BATCH_SIZE;
                    i < missingTokenIds.length && i < (batchNumber + 1) * BATCH_SIZE;
                    i += 1
                ) {
                    const tokenIdToBeFetched = missingTokenIds[i];
                    promises.push(
                        this.getAndProcessMissingServiceAgreement(
                            tokenIdToBeFetched,
                            blockchainId,
                            contract,
                        ),
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
    }

    async getAndProcessMissingServiceAgreement(tokenIdToBeFetched, blockchainId, contract) {
        try {
            const assertionIds = await this.blockchainModuleManager.getAssertionIds(
                blockchainId,
                contract,
                tokenIdToBeFetched,
            );
            const keyword = this.blockchainModuleManager.encodePacked(
                blockchainId,
                ['address', 'bytes32'],
                [contract, assertionIds[0]],
            );
            const agreementId = this.serviceAgreementService.generateId(
                blockchainId,
                contract,
                tokenIdToBeFetched,
                keyword,
                1,
            );
            const agreementData = await this.blockchainModuleManager.getAgreementData(
                blockchainId,
                agreementId,
            );
            return {
                blockchainId,
                assetStorageContractAddress: contract,
                tokenId: tokenIdToBeFetched,
                agreementId,
                startTime: agreementData?.startTime ?? 0,
                epochsNumber: agreementData?.epochsNumber ?? 0,
                epochLength: agreementData?.epochLength ?? 0,
                scoreFunctionId: agreementData?.scoreFunctionId ?? 0,
                stateIndex: 0,
                assertionId: assertionIds[0],
                hashFunctionId: 1,
                keyword,
                proofWindowOffsetPerc: agreementData?.proofWindowOffsetPerc ?? 0,
                dataSource: SERVICE_AGREEMENT_SOURCES.BLOCKCHAIN,
            };
        } catch (error) {
            this.logger.warn(`Unable to fetch agreement data for token id: ${tokenIdToBeFetched}`);
            return null;
        }
    }
}

export default GetOldServiceAgreementsMigration;
