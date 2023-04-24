/* eslint-disable no-await-in-loop */
import { formatAssertion } from 'assertion-tools';
import BaseMigration from './base-migration.js';
import { SCHEMA_CONTEXT, TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

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

    // let repository = public-current
    // get all triples from <assets:graph>
    // create object with ual as key, metadata as value
    // for ual in repository
    //     resolve ual
    //     if blockchain missing
    //         add blockchain to object
    //     if contract missing
    //         add contract to object
    //     if tokenId missing
    //         add tokenId to object
    //     get assertion ids from contract
    //     if keyword missing
    //         calculate keyword
    //         add keyword to object
    //     is latest assertion id in triple store
    //     for all assertion ids - latest
    //         if triple store has graph  <assertion:assertion id>
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
    // for ual in repository
    //     resolve ual
    //     if blockchain missing
    //         add blockchain to object
    //     if contract missing
    //         add contract to object
    //     if tokenId missing
    //         add tokenId to object
    //     get assertion ids from contract
    //     if keyword missing
    //         calculate keyword
    //         add keyword to object
    //     for all assertion ids - latest
    //         if triple store has graph  <assertion:assertion id>
    //             get assertion
    //             insert asset metadata and assertion in private-history repository
    //             if private assertion id in assertion && triple store has graph  <assertion:private assertion id>
    //                  get private assertion
    //                  insert asset metadata and private assertion in private-history repository
    //     if triple store has graph  <assertion:latest assertion id>
    //          get latest assertion
    //          if private assertion id in assertion
    //              insert object data + private assertion id link + delete old assertion id links for ual
    //     else
    //         delete metadata for ual

    async executeMigration() {
        await this.migratePublicRepositoriesMetadata();
    }

    async migratePublicRepositoriesMetadata() {
        const currentRepository = TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT;
        const historyRepository = TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY;

        const assetsQueryResult = await this.tripleStoreService.select(
            currentRepository,
            `SELECT distinct ?ual
            WHERE {
                GRAPH <assets:graph> {
                    ?ual ?p ?o
                }
            }`,
        );

        for (const { ual } of assetsQueryResult) {
            const { blockchain, contract, tokenId } = this.ualService.resolveUAL(ual);

            let assertionIds;
            try {
                assertionIds = await this.blockchainModuleManager.getAssertionIds(
                    blockchain,
                    contract,
                    tokenId,
                );
            } catch (error) {
                this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                // @TODO: verify this
                continue;
            }

            const keyword = this.blockchainModuleManager.encodePacked(
                blockchain,
                ['address', 'bytes32'],
                [contract, assertionIds[0]],
            );

            for (const assertionId of assertionIds) {
                const assertion = await this.tripleStoreService.getAssertion(
                    currentRepository,
                    assertionId,
                );

                if (assertion?.length) {
                    await this.tripleStoreService.localStoreAsset(
                        historyRepository,
                        assertionId,
                        assertion,
                        blockchain,
                        contract,
                        tokenId,
                        keyword,
                    );
                }
            }

            const latestAssertionId = assertionIds[assertionIds.length - 1];
            const assertion = await this.tripleStoreService.getAssertion(
                currentRepository,
                latestAssertionId,
            );
            if (assertion?.length) {
                const assetNquads = await formatAssertion({
                    '@context': SCHEMA_CONTEXT,
                    '@id': ual,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                    assertion: { '@id': `assertion:${latestAssertionId}` },
                }).join('\n');

                await this.tripleStoreService.queryVoid(
                    currentRepository,
                    `DELETE WHERE {
                        GRAPH <assets:graph> {
                            <${ual}> ?p ?o
                        }
                    };
                    INSERT DATA {
                        GRAPH <assets:graph> { 
                            ${assetNquads} 
                        }
                    }`,
                );
            } else {
                await this.tripleStoreService.deleteAssetMetadata(
                    currentRepository,
                    blockchain,
                    contract,
                    tokenId,
                );
            }
        }
    }
}

export default TripleStoreMetadataMigration;
