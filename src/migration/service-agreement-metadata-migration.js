import BaseMigration from './base-migration.js';
import {} from '../constants/constants.js';

class ServiceAgreementsMetadataMigraion extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        tripleStoreService,
        blockchainModuleManager,
        serviceAgreementService,
        ualService,
    ) {
        super(migrationName, logger, config);
        this.blockchainModuleManager = blockchainModuleManager;
        this.serviceAgreementService = serviceAgreementService;
        this.ualService = ualService;
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        // get metadata of all stored assets in public current triple store
        // for each asset
        //      generate agreement id
        //      get agreement data
        //      store in service_agreements table
        //      calculate current epoch
        //      get latest state index
        //      get top commits
        //      if commit submitted
        //          store in attempted-commit-command table
        //      if proof submitted
        //          store in attempted-proof-command table
    }
}

export default ServiceAgreementsMetadataMigraion;
