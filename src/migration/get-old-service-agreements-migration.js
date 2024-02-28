import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS, SERVICE_AGREEMENT_SOURCES } from '../constants/constants.js';

const BATCH_SIZE = 50;

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
        if (process.env.NODE_ENV === NODE_ENVIRONMENTS.MAINNET) {
            const gnosisBlockchainImplementation = this.blockchainModuleManager
                .getImplementationNames()
                .find((s) => s === 'gnosis:100');
            // This migration is only preforemed on Gnosis blockchain
            if (gnosisBlockchainImplementation) {
                // Handle this is array
                const contract = this.blockchainModuleManager.getAssetStorageContractAddresses(
                    gnosisBlockchainImplementation,
                );
                // This should be hardcoded for mainent
                // const contractAddress =

                const existingServiceAgreements =
                    this.repositoryModuleManager.getServiceAgreementsByBlockchanId(
                        0,
                        gnosisBlockchainImplementation,
                    );
                const existinTokenIds = existingServiceAgreements.map(
                    (serviceAgreement) => serviceAgreement.tokenId,
                );

                const lastTokenId = await this.blockchainModuleManager.getLatestTokenId(
                    gnosisBlockchainImplementation,
                    contract,
                );

                const missingTokenIds = [];
                let expectedTokenId = 0;
                existinTokenIds.forEach((tokenId) => {
                    while (tokenId > expectedTokenId) {
                        missingTokenIds.push(expectedTokenId);
                        expectedTokenId += 1;
                    }
                    expectedTokenId += 1;
                });

                for (
                    let i = existinTokenIds[existinTokenIds.lenght - 1] + 1;
                    i <= lastTokenId;
                    i += 1
                ) {
                    missingTokenIds.push(i);
                }

                let batchNumber = 0;
                // Check < or <= condition
                while (batchNumber * BATCH_SIZE < existingServiceAgreements.lenght) {
                    const promises = [];
                    const missingAgreements = [];
                    for (
                        let i = batchNumber * BATCH_SIZE;
                        i < missingTokenIds.lenght || i < (batchNumber + 1) * BATCH_SIZE;
                        i += 1
                    ) {
                        const tokenIdToBeFetched = missingTokenIds[i];
                        promises.push(
                            this.getAndProccessMisingServiceAgreement(
                                tokenIdToBeFetched,
                                gnosisBlockchainImplementation,
                                contract,
                                missingAgreements,
                            ),
                        );
                    }

                    // eslint-disable-next-line no-await-in-loop
                    await Promise.all(promises);

                    // eslint-disable-next-line no-await-in-loop
                    await this.repositoryModuleManager.bulkCreateServiceAgreementRecords(
                        missingAgreements,
                    );
                    batchNumber += 1;
                }
            }
        }
    }

    async getAndProccessMisingServiceAgreement(
        tokenIdToBeFetched,
        gnosisBlockchainImplementation,
        contract,
        missingAgreements,
    ) {
        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            gnosisBlockchainImplementation,
            contract,
            tokenIdToBeFetched,
        );
        const keyword = this.blockchainModuleManager.encodePacked(
            gnosisBlockchainImplementation,
            ['address', 'bytes32'],
            [contract, assertionIds[0]],
        );
        const agreementId = this.serviceAgreementService.generateId(
            gnosisBlockchainImplementation,
            contract,
            tokenIdToBeFetched,
            keyword,
            1,
        );

        const agreementData = await this.blockchainModuleManager.getAgreementData(
            gnosisBlockchainImplementation,
            agreementId,
        );

        // TODO: Use ...agreementData
        missingAgreements.push({
            blockchainId: gnosisBlockchainImplementation,
            assetStorageContractAddress: contract,
            tokenId: tokenIdToBeFetched,
            agreementId,
            startTime: agreementData.startTime,
            epochsNumber: agreementData.epochsNumber,
            epochLength: agreementData.epochLength,
            scoreFunctionId: agreementData.scoreFunctionId,
            stateIndex: 0,
            assertionId: assertionIds[0],
            hashFunctionId: 1,
            keyword,
            proofWindowOffsetPerc: agreementData.proofWindowOffsetPerc,
            dataSource: SERVICE_AGREEMENT_SOURCES.BLOCKCHAIN,
        });
    }
}

export default GetOldServiceAgreementsMigration;
