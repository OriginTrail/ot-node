import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS } from '../constants/constants.js';

class GetOldServiceAgreementsMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager, blockchainModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.blockchainModuleManager = blockchainModuleManager;
    }

    async executeMigration() {
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.TEST
        ) {
            const gnosisBlockcchainImplementation = this.blockchainModuleManager
                .getImplementationNames()
                .find((s) => s.startsWith('gnosis'));
            // This migration is only preforemed on Gnosis blockchain
            if (gnosisBlockcchainImplementation) {
                const existingServiceAgreements =
                    this.repositoryModuleManager.getServiceAgreementsByBlockchanId(
                        0,
                        gnosisBlockcchainImplementation,
                    );

                let tokenIdToBeFetched = 0;
                let i = 0;
                while (i < existingServiceAgreements.lenght) {
                    if (tokenIdToBeFetched < i) {
                        // Logic to get and insert agreementId
                        tokenIdToBeFetched += 1;
                    } else {
                        i += 1;
                    }
                }
            }
        }
    }
}

export default GetOldServiceAgreementsMigration;
