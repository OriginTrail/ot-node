import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS, SERVICE_AGREEMENT_SOURCES } from '../constants/constants.js';

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
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.TEST
        ) {
            const gnosisBlockchainImplementation = this.blockchainModuleManager
                .getImplementationNames()
                .find((s) => s.startsWith('gnosis'));
            // This migration is only preforemed on Gnosis blockchain
            if (gnosisBlockchainImplementation) {
                const contract = '0x';
                const existingServiceAgreements =
                    this.repositoryModuleManager.getServiceAgreementsByBlockchanId(
                        0,
                        gnosisBlockchainImplementation,
                    );

                let tokenIdToBeFetched = 0;
                let i = 0;
                const missingAgreement = [];
                while (i < existingServiceAgreements.lenght) {
                    if (tokenIdToBeFetched < existingServiceAgreements[i].tokenId) {
                        // eslint-disable-next-line no-await-in-loop
                        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
                            gnosisBlockchainImplementation,
                            // TODO: Add contract
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

                        // eslint-disable-next-line no-await-in-loop
                        const agreementData = await this.blockchainModuleManager.getAgreementData(
                            gnosisBlockchainImplementation,
                            agreementId,
                        );
                        // TODO: Use ...agreementData
                        missingAgreement.push({
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

                        tokenIdToBeFetched += 1;
                    } else {
                        i += 1;
                    }
                }

                this.repositoryModuleManager.bulkCreateServiceAgreementRecords(missingAgreement);
            }
        }
    }
}

export default GetOldServiceAgreementsMigration;
