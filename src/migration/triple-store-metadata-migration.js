import BaseMigration from './base-migration.js';
import {} from '../constants/constants.js';

class TripleStoreMetadataMigration extends BaseMigration {
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
        // let repository = public-current
        // get all triples from <assets:graph>
        // create object with ual as key, metadata as value
        // get distinct assertion ids from repository
        // for ual in repository
        //     resolve ual
        //     if blockchain missing
        //         add blockchain to object
        //     if contract missing
        //         add contract to object
        //     if tokenId missing
        //         add tokenId to object
        //     get assertion ids from chain
        //     if keyword missing
        //         calculate keyword
        //         add keyword to object
        //     for all assertion ids - latest
        //         if repository assertion ids includes assertion id
        //             get assertion
        //             insert asset metadata and assertion in public-history repository
        //     if repository assertion ids includes latest assertion id
        //         insert object data + delete old assertion id links for ual
        //     else
        //         delete metadata for ual
        //
        //
        // repository = private-current
        // get all triples from <assets:graph>
        // create object with ual as key, metadata as value
        // get distinct assertion ids from repository
        // get distinct private assertion ids from repository
        // for ual in repository
        //     resolve ual
        //     if blockchain missing
        //         add blockchain to object
        //     if contract missing
        //         add contract to object
        //     if tokenId missing
        //         add tokenId to object
        //     get assertion ids from chain
        //     if keyword missing
        //         calculate keyword
        //         add keyword to object
        //     for all assertion ids - latest
        //         if repository assertion ids includes assertion id
        //             get assertion
        //             insert asset metadata and assertion in private-history repository
        //             if repository assertion ids includes private assertion id
        //                  get private assertion
        //                  insert asset metadata and assertion in private-history repository
        //     if repository assertion ids includes latest assertion id
        //         insert object data + delete old assertion id links for ual
        //     else
        //         delete metadata for ual
    }
}

export default TripleStoreMetadataMigration;
