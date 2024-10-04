/* eslint-disable no-await-in-loop */
import { formatAssertion } from 'assertion-tools';
import path from 'path';
import BaseMigration from './base-migration.js';
import { SCHEMA_CONTEXT, TRIPLE_STORE } from '../constants/constants.js';

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
        await this.updatePublicCurrentMetadata();
        await this.updatePrivateCurrentMetadata();
    }

    async updatePublicCurrentMetadata() {
        const currentRepository = TRIPLE_STORE.REPOSITORIES.PUBLIC_CURRENT;
        const historyRepository = TRIPLE_STORE.REPOSITORIES.PUBLIC_HISTORY;
        const migrationFolderPath = this.fileService.getMigrationFolderPath();
        const migrationInfoFileName = `${this.migrationName}_${currentRepository}`;
        const migrationInfoPath = path.join(migrationFolderPath, migrationInfoFileName);

        let migrationInfo;
        if (await this.fileService.pathExists(migrationInfoPath)) {
            try {
                migrationInfo = await this.fileService.readFile(migrationInfoPath, true);
            } catch (error) {
                migrationInfo = {
                    status: 'IN_PROGRESS',
                    processedUals: {},
                    deletedAssertions: [],
                };
            }

            if (migrationInfo.status === 'COMPLETED') return;
        } else {
            migrationInfo = {
                status: 'IN_PROGRESS',
                processedUals: {},
                deletedAssertions: [],
            };
        }

        await this._logMetadataStats(currentRepository);

        migrationInfo = await this.updateBlockchainMetadata(currentRepository, migrationInfo);
        migrationInfo = await this.updateContractMetadata(currentRepository, migrationInfo);
        await this.deleteUnsupportedAssetsMetadata(currentRepository);
        migrationInfo = await this.updateKeywordMetadata(currentRepository, migrationInfo);
        migrationInfo = await this.updateAssertionMetadata(
            currentRepository,
            historyRepository,
            migrationInfo,
        );
        migrationInfo = await this.deleteUnlinkedAssertions(currentRepository, migrationInfo);

        await this._logMetadataStats(currentRepository);

        migrationInfo.status = 'COMPLETED';
        await this._updateMigrationInfoFile(currentRepository, migrationInfo);
    }

    async updatePrivateCurrentMetadata() {
        const currentRepository = TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT;
        const historyRepository = TRIPLE_STORE.REPOSITORIES.PRIVATE_HISTORY;
        const migrationFolderPath = this.fileService.getMigrationFolderPath();
        const migrationInfoFileName = `${this.migrationName}_${currentRepository}`;
        const migrationInfoPath = path.join(migrationFolderPath, migrationInfoFileName);
        let migrationInfo;
        if (await this.fileService.pathExists(migrationInfoPath)) {
            try {
                migrationInfo = await this.fileService.readFile(migrationInfoPath, true);
            } catch (error) {
                migrationInfo = {
                    status: 'IN_PROGRESS',
                    processedUals: {},
                    deletedAssertions: [],
                };
            }

            if (migrationInfo.status === 'COMPLETED') return;
        } else {
            const assetsQueryResult = await this.tripleStoreService.select(
                currentRepository,
                `SELECT distinct ?ual
                    WHERE {
                        GRAPH <assets:graph> {
                            ?ual ?p ?o
                        }
                    }`,
            );

            migrationInfo = {
                status: 'IN_PROGRESS',
                ualsToProcess: assetsQueryResult.map(({ ual }) => ual),
                processedUals: {},
                deletedAssertions: [],
            };
        }

        await this._logMetadataStats(currentRepository);

        const ualsToProcess = JSON.parse(JSON.stringify(migrationInfo.ualsToProcess));
        for (let i = 0; i < ualsToProcess.length; i += 1) {
            this._logPercentage(i, ualsToProcess.length, currentRepository);
            const ual = ualsToProcess[i];
            if (!migrationInfo.processedUals[ual]) migrationInfo.processedUals[ual] = {};

            let resolvedUAL;
            try {
                resolvedUAL = this.ualService.resolveUAL(ual);
            } catch (error) {
                this.logger.warn(`Unable to resolve UAL: ${error}`);
                continue;
            }

            const { blockchain, contract, tokenId } = resolvedUAL;

            let assertionIds;
            try {
                assertionIds = await this.blockchainModuleManager.getAssertionIds(
                    blockchain,
                    contract,
                    tokenId,
                );
                migrationInfo.processedUals[ual].assertionIds = assertionIds;
            } catch (error) {
                this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                migrationInfo.ualsToProcess.splice(i, 1);
                await this._updateMigrationInfoFile(currentRepository, migrationInfo);
                continue;
            }

            if (!assertionIds?.length) {
                this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                migrationInfo.ualsToProcess.splice(i, 1);
                await this._updateMigrationInfoFile(currentRepository, migrationInfo);
                continue;
            }

            const keyword = this.blockchainModuleManager.encodePacked(
                blockchain,
                ['address', 'bytes32'],
                [contract, assertionIds[0]],
            );

            migrationInfo = await this._moveOldAssertionIds(
                currentRepository,
                historyRepository,
                ual,
                blockchain,
                contract,
                tokenId,
                keyword,
                assertionIds,
                migrationInfo,
            );

            migrationInfo = await this._updateAssetMetadata(
                currentRepository,
                assertionIds,
                ual,
                blockchain,
                contract,
                tokenId,
                keyword,
                migrationInfo,
            );

            migrationInfo.ualsToProcess.splice(i, 1);
            await this._updateMigrationInfoFile(currentRepository, migrationInfo);
        }
        await this.deleteUnlinkedAssertions(currentRepository, migrationInfo);

        await this._logMetadataStats(currentRepository);

        migrationInfo.status = 'COMPLETED';
        await this._updateMigrationInfoFile(currentRepository, migrationInfo);
    }

    async updateBlockchainMetadata(repository, migrationInfo) {
        const assetsQueryResult = await this.tripleStoreService.select(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>
                SELECT DISTINCT ?ual
                    WHERE {
                    GRAPH <assets:graph> {
                        ?ual ?p ?o .
                        FILTER NOT EXISTS {
                            ?ual schema:blockchain ?blockchain .
                        }
                    }
                }`,
        );

        this.logger.debug(
            `found ${assetsQueryResult.length} assets with missing blockchain metadata`,
        );

        let triples = '';
        let processedAssets = [];
        const migrationInfoCopy = migrationInfo;
        for (let i = 0; i < assetsQueryResult.length; i += 1) {
            const { ual } = assetsQueryResult[i];
            let resolvedUAL;
            try {
                resolvedUAL = this.ualService.resolveUAL(ual);
            } catch (error) {
                this.logger.warn(`Unable to resolve UAL: ${error}`);
                continue;
            }

            const { blockchain } = resolvedUAL;

            triples += `<${ual}> schema:blockchain "${blockchain}" . \n`;
            processedAssets.push({ ual, blockchain });
            if (i % 10_000 === 0) {
                await this.insertMetadataTriples(repository, triples);
                for (const processedAsset of processedAssets) {
                    if (!migrationInfoCopy.processedUals[processedAsset.ual])
                        migrationInfoCopy.processedUals[processedAsset.ual] = {
                            blockchain: processedAsset.blockchain,
                        };
                    else
                        migrationInfoCopy.processedUals[processedAsset.ual].blockchain =
                            processedAsset.blockchain;
                }
                await this._updateMigrationInfoFile(repository, migrationInfoCopy);
                triples = '';
                processedAssets = [];
            }
        }
        await this.insertMetadataTriples(repository, triples);
        return migrationInfoCopy;
    }

    async updateContractMetadata(repository, migrationInfo) {
        const assetsQueryResult = await this.tripleStoreService.select(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>
                SELECT DISTINCT ?ual
                WHERE {
                    GRAPH <assets:graph> {
                        ?ual ?p ?o .
                        FILTER NOT EXISTS {
                            ?ual schema:contract ?contract .
                        }
                    }
                }`,
        );

        this.logger.debug(
            `found ${assetsQueryResult.length} assets with missing contract metadata`,
        );

        let triples = '';
        let processedAssets = [];
        const migrationInfoCopy = migrationInfo;
        for (let i = 0; i < assetsQueryResult.length; i += 1) {
            const { ual } = assetsQueryResult[i];
            let resolvedUAL;
            try {
                resolvedUAL = this.ualService.resolveUAL(ual);
            } catch (error) {
                this.logger.warn(`Unable to resolve UAL: ${error}`);
                continue;
            }

            const { contract } = resolvedUAL;

            triples += `<${ual}> schema:contract "${contract}" . \n`;
            processedAssets.push({ ual, contract });
            if (i % 10_000 === 0) {
                await this.insertMetadataTriples(repository, triples);
                for (const processedAsset of processedAssets) {
                    if (!migrationInfoCopy.processedUals[processedAsset.ual])
                        migrationInfoCopy.processedUals[processedAsset.ual] = {
                            contract: processedAsset.contract,
                        };
                    else
                        migrationInfoCopy.processedUals[processedAsset.ual].contract =
                            processedAsset.contract;
                }
                await this._updateMigrationInfoFile(repository, migrationInfoCopy);
                triples = '';
                processedAssets = [];
            }
        }
        await this.insertMetadataTriples(repository, triples);
        return migrationInfoCopy;
    }

    async updateKeywordMetadata(repository, migrationInfo) {
        const assetsQueryResult = await this.tripleStoreService.select(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>
                SELECT DISTINCT ?ual
                    WHERE {
                    GRAPH <assets:graph> {
                        ?ual ?p ?o .
                        FILTER NOT EXISTS {
                            ?ual schema:keyword ?keyword .
                        }
                    }
                }`,
        );

        this.logger.debug(`found ${assetsQueryResult.length} assets with missing keyword metadata`);

        let triples = '';
        const processedAssets = [];
        const migrationInfoCopy = migrationInfo;
        for (const { ual } of assetsQueryResult) {
            let resolvedUAL;
            try {
                resolvedUAL = this.ualService.resolveUAL(ual);
            } catch (error) {
                this.logger.warn(`Unable to resolve UAL: ${error}`);
                continue;
            }

            const { blockchain, contract, tokenId } = resolvedUAL;

            let assertionIds;
            try {
                assertionIds = await this.blockchainModuleManager.getAssertionIds(
                    blockchain,
                    contract,
                    tokenId,
                );
            } catch (error) {
                this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                continue;
            }

            if (!assertionIds?.length) {
                this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                continue;
            }

            const keyword = this.blockchainModuleManager.encodePacked(
                blockchain,
                ['address', 'bytes32'],
                [contract, assertionIds[0]],
            );

            triples += `<${ual}> schema:keyword "${keyword}" . \n`;
            processedAssets.push({ ual, keyword });
        }

        for (const processedAsset of processedAssets) {
            if (!migrationInfoCopy.processedUals[processedAsset.ual])
                migrationInfoCopy.processedUals[processedAsset.ual] = {
                    keyword: processedAsset.keyword,
                };
            else
                migrationInfoCopy.processedUals[processedAsset.ual].keyword =
                    processedAsset.keyword;
        }
        await this.insertMetadataTriples(repository, triples);
        await this._updateMigrationInfoFile(repository, migrationInfoCopy);
        return migrationInfoCopy;
    }

    async updateAssertionMetadata(currentRepository, historyRepository, migrationInfo) {
        const assetsQueryResult = await this.tripleStoreService.select(
            currentRepository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>

            SELECT distinct ?ual
            WHERE {
                {
                    GRAPH <assets:graph> {
                        ?ual ?p ?o .
                    }
                    FILTER NOT EXISTS {
                        ?ual schema:assertion ?assertion .
                    }
                }
                            UNION
                {
                    GRAPH <assets:graph> {
                        ?ual schema:assertion ?assertion1 .
                        ?ual schema:assertion ?assertion2 .
                    }
                    FILTER (?assertion1 != ?assertion2)
                }
            }`,
        );

        this.logger.debug(
            `found ${assetsQueryResult.length} assets not containing exactly one assertion id in metadata`,
        );

        let migrationInfoCopy = migrationInfo;
        for (const { ual } of assetsQueryResult) {
            if (!migrationInfoCopy.processedUals[ual]) migrationInfoCopy.processedUals[ual] = {};
            let resolvedUAL;
            try {
                resolvedUAL = this.ualService.resolveUAL(ual);
            } catch (error) {
                this.logger.warn(`Unable to resolve UAL: ${error}`);
                continue;
            }

            const { blockchain, contract, tokenId } = resolvedUAL;

            let assertionIds;
            try {
                assertionIds = await this.blockchainModuleManager.getAssertionIds(
                    blockchain,
                    contract,
                    tokenId,
                );
                migrationInfoCopy.processedUals[ual].assertionIds = assertionIds;
            } catch (error) {
                this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                continue;
            }

            if (!assertionIds?.length) {
                this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                continue;
            }

            const keyword = this.blockchainModuleManager.encodePacked(
                blockchain,
                ['address', 'bytes32'],
                [contract, assertionIds[0]],
            );

            migrationInfoCopy = await this._moveOldAssertionIds(
                currentRepository,
                historyRepository,
                ual,
                blockchain,
                contract,
                tokenId,
                keyword,
                assertionIds,
                migrationInfoCopy,
            );

            migrationInfoCopy = await this._updateAssetMetadata(
                currentRepository,
                assertionIds,
                ual,
                blockchain,
                contract,
                tokenId,
                keyword,
                migrationInfoCopy,
            );
        }

        return migrationInfoCopy;
    }

    async _moveOldAssertionIds(
        currentRepository,
        historyRepository,
        ual,
        blockchain,
        contract,
        tokenId,
        keyword,
        assertionIds,
        migrationInfo,
    ) {
        const migrationInfoCopy = migrationInfo;
        for (let i = 0; i < assertionIds.length - 1; i += 1) {
            const publicAssertionId = assertionIds[i];
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
                if (!migrationInfoCopy.processedUals[ual].copiedHistory) {
                    migrationInfoCopy.processedUals[ual].copiedHistory = [];
                }
                migrationInfoCopy.processedUals[ual].copiedHistory.push({
                    stateIndex: i,
                    publicAssertionId,
                    publicAssertion,
                });

                await this._updateMigrationInfoFile(currentRepository, migrationInfoCopy);

                if (currentRepository === TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT) {
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
                            migrationInfoCopy.processedUals[ual].copiedHistory.push({
                                stateIndex: i,
                                privateAssertionId,
                                privateAssertion,
                            });
                            await this._updateMigrationInfoFile(
                                currentRepository,
                                migrationInfoCopy,
                            );
                        }
                    }
                }
            }
        }

        return migrationInfoCopy;
    }

    async _updateAssetMetadata(
        currentRepository,
        assertionIds,
        ual,
        blockchain,
        contract,
        tokenId,
        keyword,
        migrationInfo,
    ) {
        const migrationInfoCopy = migrationInfo;
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

            if (currentRepository === TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT) {
                const latestPrivateAssertionId =
                    this.dataService.getPrivateAssertionId(latestPublicAssertion);
                if (latestPrivateAssertionId) {
                    assetMetadata.assertion.push({
                        '@id': `assertion:${latestPrivateAssertionId}`,
                    });
                }
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
            migrationInfoCopy.processedUals[ual].upddatedMetadata = true;
        } else {
            await this.tripleStoreService.deleteAssetMetadata(
                currentRepository,
                blockchain,
                contract,
                tokenId,
            );
            migrationInfoCopy.processedUals[ual].deletedMetadata = true;
        }

        await this._updateMigrationInfoFile(currentRepository, migrationInfoCopy);

        return migrationInfoCopy;
    }

    async deleteUnsupportedAssetsMetadata(repository) {
        let assetStorageContractAddresses = [];
        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            assetStorageContractAddresses = assetStorageContractAddresses.concat(
                await this.blockchainModuleManager.getAssetStorageContractAddresses(blockchain),
            );
        }

        const deleteQuery = `
                    PREFIX schema: <${SCHEMA_CONTEXT}>

                    DELETE {
                    GRAPH <assets:graph> { ?s ?p ?o . }
                    } WHERE {
                    GRAPH <assets:graph> {
                        ?s ?p ?o .
                        ?s schema:contract ?o2 .
                        FILTER NOT EXISTS {
                        VALUES ?oValue { ${assetStorageContractAddresses
                            .map((addr) => `"${addr}"`)
                            .join(' ')} }
                        FILTER (?o2 = ?oValue)
                        }
                    }
                    }`;

        await this.tripleStoreService.queryVoid(repository, deleteQuery);
    }

    async deleteUnlinkedAssertions(repository, migrationInfo) {
        let assetsQueryResult;
        const migrationInfoCopy = migrationInfo;
        do {
            assetsQueryResult = await this.tripleStoreService.select(
                repository,
                `PREFIX schema: <${SCHEMA_CONTEXT}>

                SELECT DISTINCT ?g WHERE {
                    GRAPH ?g { ?s ?p ?o . }
                    FILTER NOT EXISTS {
                        GRAPH <assets:graph> {
                            ?ual schema:assertion ?g .
                        }
                    }
                    FILTER (?g != <assets:graph>)
                }
                LIMIT 100`,
            );
            if (assetsQueryResult?.length) {
                assetsQueryResult = assetsQueryResult.filter(({ g }) => g.startsWith('assertion:'));
            }
            this.logger.debug(
                `found ${assetsQueryResult.length} assertions not linked to any asset.`,
            );
            let deleteQuery = '';
            if (!migrationInfoCopy.deletedAssertions) migrationInfoCopy.deletedAssertions = [];
            for (const { g } of assetsQueryResult) {
                deleteQuery += `
                    WITH <${g}>
                    DELETE { ?s ?p ?o }
                    WHERE { ?s ?p ?o };`;
                migrationInfoCopy.deletedAssertions.push(g);
            }

            if (deleteQuery !== '') {
                await this.tripleStoreService.queryVoid(repository, deleteQuery);
            }
            await this._updateMigrationInfoFile(repository, migrationInfoCopy);
        } while (assetsQueryResult?.length);

        return migrationInfoCopy;
    }

    async _logMetadataStats(repository) {
        const allAssetsResult = await this.tripleStoreService.select(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>

            SELECT 
            (COUNT(DISTINCT ?ual) AS ?all)
            WHERE {
                GRAPH <assets:graph> {
                    {
                        ?ual ?p ?o .
                    }
                }
            }`,
        );
        let stats = this.dataService.parseBindings(allAssetsResult)[0];

        let log = `metadata stats for ${repository} repository: `;
        log += `\n\t\t\t\tdistinct number of uals: ${stats.all}`;

        const predicates = ['blockchain', 'contract', 'tokenId', 'keyword', 'assertion'];
        for (const predicate of predicates) {
            stats = await this._getPredicateStats(repository, predicate);
            log += `\n\t\t\t\tdistinct number of uals with predicate ${predicate}: ${stats}`;
        }
        this.logger.debug(log);
    }

    async _getPredicateStats(repository, predicate) {
        const query = `
            PREFIX schema: <${SCHEMA_CONTEXT}>
                SELECT 
                (COUNT(DISTINCT ?ual) AS ?${predicate})
                WHERE {
                    GRAPH <assets:graph> {
                        {
                            ?ual schema:${predicate} ?${predicate} .
                        }
                    }
                }`;

        const result = await this.tripleStoreService.select(repository, query);
        const stats = this.dataService.parseBindings(result)[0];

        return stats[predicate];
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

    async _updateMigrationInfoFile(repository, migrationInfo) {
        const migrationFolderPath = this.fileService.getMigrationFolderPath();
        const migrationInfoFileName = `${this.migrationName}_${repository}`;

        await this.fileService.writeContentsToFile(
            migrationFolderPath,
            migrationInfoFileName,
            JSON.stringify(migrationInfo),
        );
    }

    async insertMetadataTriples(repository, triples) {
        await this.tripleStoreService.queryVoid(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>
                    INSERT DATA {
                        GRAPH <assets:graph> { 
                            ${triples} 
                        }
                    }`,
        );
    }
}

export default TripleStoreMetadataMigration;
