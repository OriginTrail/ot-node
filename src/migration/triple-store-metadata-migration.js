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
        dataService,
    ) {
        super(migrationName, logger, config);
        this.blockchainModuleManager = blockchainModuleManager;
        this.serviceAgreementService = serviceAgreementService;
        this.ualService = ualService;
        this.tripleStoreService = tripleStoreService;
        this.dataService = dataService;
    }

    async executeMigration() {
        await this.migratePublicRepositoriesMetadata();
        await this.migratePrivateRepositoriesMetadata();
    }

    async migratePublicRepositoriesMetadata() {
        const currentRepository = TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT;
        const historyRepository = TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY;

        await this._logMetadataStats(currentRepository);

        const assetsQueryResult = await this.tripleStoreService.select(
            currentRepository,
            `SELECT distinct ?ual
            WHERE {
                GRAPH <assets:graph> {
                    ?ual ?p ?o
                }
            }`,
        );

        for (let i = 0; i < assetsQueryResult.length; i += 1) {
            this._logPercentage(i, assetsQueryResult.length, currentRepository);
            const { ual } = assetsQueryResult[i];
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

            for (let j; j < assertionIds.length - 1; j += 1) {
                const assertionId = assertionIds[j];
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
                const assetMetadataNquads = await formatAssertion({
                    '@context': SCHEMA_CONTEXT,
                    '@id': ual,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                    assertion: { '@id': `assertion:${latestAssertionId}` },
                });

                await this.tripleStoreService.queryVoid(
                    currentRepository,
                    `DELETE WHERE {
                        GRAPH <assets:graph> {
                            <${ual}> ?p ?o
                        }
                    };
                    INSERT DATA {
                        GRAPH <assets:graph> { 
                            ${assetMetadataNquads.join('\n')} 
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
        await this._logMetadataStats(currentRepository);
    }

    async migratePrivateRepositoriesMetadata() {
        const currentRepository = TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT;
        const historyRepository = TRIPLE_STORE_REPOSITORIES.PRIVATE_HISTORY;

        await this._logMetadataStats(currentRepository);
        const assetsQueryResult = await this.tripleStoreService.select(
            currentRepository,
            `SELECT distinct ?ual
            WHERE {
                GRAPH <assets:graph> {
                    ?ual ?p ?o
                }
            }`,
        );

        for (let i = 0; i < assetsQueryResult.length; i += 1) {
            this._logPercentage(i, assetsQueryResult.length, currentRepository);
            const { ual } = assetsQueryResult[i];
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

            for (let j; j < assertionIds.length - 1; j += 1) {
                const publicAssertionId = assertionIds[j];
                const publicAssertion = await this.tripleStoreService.getAssertion(
                    currentRepository,
                    publicAssertionId,
                );

                if (publicAssertion?.length) {
                    await this.tripleStoreService.localStoreAsset(
                        historyRepository,
                        publicAssertionId,
                        publicAssertion,
                        blockchain,
                        contract,
                        tokenId,
                        keyword,
                    );

                    const privateAssertionId =
                        this.dataService.getPrivateAssertionId(publicAssertion);
                    if (privateAssertionId) {
                        const privateAssertion = await this.tripleStoreService.getAssertion(
                            currentRepository,
                            privateAssertionId,
                        );

                        if (privateAssertion?.length) {
                            await this.tripleStoreService.localStoreAsset(
                                historyRepository,
                                privateAssertionId,
                                privateAssertion,
                                blockchain,
                                contract,
                                tokenId,
                                keyword,
                            );
                        }
                    }
                }
            }

            const latestPublicAssertionId = assertionIds[assertionIds.length - 1];
            const latestPublicAssertion = await this.tripleStoreService.getAssertion(
                currentRepository,
                latestPublicAssertionId,
            );
            if (latestPublicAssertion?.length) {
                const assetMetadata = {
                    '@context': SCHEMA_CONTEXT,
                    '@id': ual,
                    blockchain,
                    contract,
                    tokenId,
                    keyword,
                    assertion: [{ '@id': `assertion:${latestPublicAssertionId}` }],
                };

                const latestPrivateAssertionId =
                    this.dataService.getPrivateAssertionId(latestPublicAssertion);
                if (latestPrivateAssertionId) {
                    assetMetadata.assertion.push({
                        '@id': `assertion:${latestPrivateAssertionId}`,
                    });
                }

                const assetMetadataNquads = await formatAssertion(assetMetadata);
                await this.tripleStoreService.queryVoid(
                    currentRepository,
                    `DELETE WHERE {
                        GRAPH <assets:graph> {
                            <${ual}> ?p ?o
                        }
                    };
                    INSERT DATA {
                        GRAPH <assets:graph> { 
                            ${assetMetadataNquads.join('\n')} 
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
        await this._logMetadataStats(currentRepository);
    }

    async _logMetadataStats(repository) {
        const result = await this.tripleStoreService.select(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>

            SELECT 
            (COUNT(DISTINCT ?ualAll) AS ?all)
            (COUNT(DISTINCT ?ualBlockchain) AS ?blockchain)
            (COUNT(DISTINCT ?ualContract) AS ?contract)
            (COUNT(DISTINCT ?ualTokenId) AS ?tokenId)
            (COUNT(DISTINCT ?ualKeyword) AS ?keyword)
            (COUNT(DISTINCT ?ualAssertion) AS ?assertion)
            WHERE {
                GRAPH <assets:graph> {
                    {
                        ?ualAll ?p ?o .
                    }
                    UNION
                    {
                        ?ualBlockchain schema:blockchain ?blockchain .
                    }
                    UNION
                    {
                        ?ualContract schema:contract ?contract .
                    }
                    UNION
                    {
                        ?ualTokenId schema:tokenId ?tokenId .
                    }
                    UNION
                    {
                        ?ualKeyword schema:keyword ?keyword .
                    }
                    UNION
                    {
                        ?ualAssertion schema:assertion ?assertion .
                    }
                }
            }`,
        );

        const stats = this.dataService.parseBindings(result)[0];

        let log = `metadata stats for ${repository} repository: `;
        for (const key in stats) {
            if (key === 'all') log += `\n\t\t\t\tdistinct number of uals: ${stats.all}`;
            else log += `\n\t\t\t\tdistinct number of uals with predicate ${key}: ${stats[key]}`;
        }

        this.logger.debug(log);
    }

    _logPercentage(index, max, repository) {
        const previousPercentage = (Math.max(0, index - 1) / max) * 100;
        const currentPercentage = (index / max) * 100;

        if (Math.floor(currentPercentage) - Math.floor(previousPercentage) < 1) return;

        this.logger.debug(
            `${this.migrationName} at ${
                Math.floor(currentPercentage * 10) / 10
            }% for ${repository} repository`,
        );
    }
}

export default TripleStoreMetadataMigration;
