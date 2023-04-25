/* eslint-disable no-await-in-loop */
import { formatAssertion } from 'assertion-tools';
import path from 'path';
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
        await this.updatePublicCurrentMetadata();
        await this.updatePrivateCurrentMetadata();
    }

    async updatePublicCurrentMetadata() {
        const currentRepository = TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT;
        const historyRepository = TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY;
        const migrationFolderPath = this.fileService.getMigrationFolderPath();
        const migrationInfoFileName = `${this.migrationName}_${currentRepository}`;
        const migrationInfoPath = path.join(migrationFolderPath, migrationInfoFileName);

        if (await this.fileService.fileExists(migrationInfoPath)) {
            return;
        }

        await this._logMetadataStats(currentRepository);

        await this.updateBlockchainMetadata(currentRepository);
        await this.updateContractMetadata(currentRepository);
        await this.updateKeywordMetadata(currentRepository);
        await this.updateAssertionMetadata(currentRepository, historyRepository);

        await this._logMetadataStats(currentRepository);

        await this.fileService.writeContentsToFile(
            migrationFolderPath,
            migrationInfoFileName,
            'COMPLETED',
        );
    }

    async updatePrivateCurrentMetadata() {
        const currentRepository = TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT;
        const historyRepository = TRIPLE_STORE_REPOSITORIES.PRIVATE_HISTORY;
        const migrationFolderPath = this.fileService.getMigrationFolderPath();
        const migrationInfoFileName = `${this.migrationName}_${currentRepository}`;
        const migrationInfoPath = path.join(migrationFolderPath, migrationInfoFileName);
        let migrationInfo;
        if (await this.fileService.fileExists(migrationInfoPath)) {
            migrationInfo = await this.fileService._readFile(migrationInfoPath, true);
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
            };
        }

        if (migrationInfo.status === 'COMPLETED') return;

        await this._logMetadataStats(currentRepository);

        const ualsToProcess = JSON.parse(JSON.stringify(migrationInfo.ualsToProcess));
        for (let i = 0; i < ualsToProcess.length; i += 1) {
            this._logPercentage(i, ualsToProcess.length, currentRepository);
            const ual = ualsToProcess[i];
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
                migrationInfo.ualsToProcess.splice(i, 1);
                await this.fileService.writeContentsToFile(
                    migrationFolderPath,
                    migrationInfoFileName,
                    JSON.stringify(migrationInfo),
                );
                continue;
            }

            if (!assertionIds?.length) {
                this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
                migrationInfo.ualsToProcess.splice(i, 1);
                await this.fileService.writeContentsToFile(
                    migrationFolderPath,
                    migrationInfoFileName,
                    JSON.stringify(migrationInfo),
                );
                continue;
            }

            const keyword = this.blockchainModuleManager.encodePacked(
                blockchain,
                ['address', 'bytes32'],
                [contract, assertionIds[0]],
            );

            await this._moveOldAssertionIds(
                currentRepository,
                historyRepository,
                blockchain,
                contract,
                tokenId,
                keyword,
                assertionIds,
            );

            await this._updateAssetMetadata(
                currentRepository,
                assertionIds,
                ual,
                blockchain,
                contract,
                tokenId,
                keyword,
            );

            migrationInfo.ualsToProcess.splice(i, 1);
            await this.fileService.writeContentsToFile(
                migrationFolderPath,
                migrationInfoFileName,
                JSON.stringify(migrationInfo),
            );
        }

        migrationInfo.status = 'COMPLETED';
        await this.fileService.writeContentsToFile(
            migrationFolderPath,
            migrationInfoFileName,
            JSON.stringify(migrationInfo),
        );
        await this._logMetadataStats(currentRepository);
    }

    async updateBlockchainMetadata(repository) {
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

        let blockchainTriples = '';
        for (const { ual } of assetsQueryResult) {
            const { blockchain } = this.ualService.resolveUAL(ual);

            blockchainTriples += `<${ual}> schema:blockchain "${blockchain}" . \n`;
        }

        await this.tripleStoreService.queryVoid(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <assets:graph> { 
                    ${blockchainTriples} 
                }
            }`,
        );
    }

    async updateContractMetadata(repository) {
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

        let contractTriples = '';
        for (const { ual } of assetsQueryResult) {
            const { contract } = this.ualService.resolveUAL(ual);

            contractTriples += `<${ual}> schema:contract "${contract}" . \n`;
        }

        await this.tripleStoreService.queryVoid(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <assets:graph> { 
                    ${contractTriples} 
                }
            }`,
        );
    }

    async updateKeywordMetadata(repository) {
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

        let keywordTriples = '';
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
                continue;
            }

            const keyword = this.blockchainModuleManager.encodePacked(
                blockchain,
                ['address', 'bytes32'],
                [contract, assertionIds[0]],
            );

            keywordTriples += `<${ual}> schema:keyword "${keyword}" . \n`;
        }

        await this.tripleStoreService.queryVoid(
            repository,
            `PREFIX schema: <${SCHEMA_CONTEXT}>
            INSERT DATA {
                GRAPH <assets:graph> { 
                    ${keywordTriples} 
                }
            }`,
        );
    }

    async updateAssertionMetadata(currentRepository, historyRepository) {
        const assetsQueryResult = await this.tripleStoreService.select(
            currentRepository,
            `PREFIX schema: <http://schema.org/>

            SELECT distinct ?s
            WHERE {
                {
                    GRAPH <assets:graph> {
                        ?s ?p ?o .
                    }
                    FILTER NOT EXISTS {
                        ?s schema:assertion ?assertion .
                    }
                }
                            UNION
                {
                    GRAPH <assets:graph> {
                        ?s schema:assertion ?assertion1 .
                        ?s schema:assertion ?assertion2 .
                    }
                    FILTER (?assertion1 != ?assertion2)
                }
            }`,
        );

        this.logger.debug(
            `found ${assetsQueryResult.length} assets not containing exactly one assertion id in metadata`,
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

            await this._moveOldAssertionIds(
                currentRepository,
                historyRepository,
                blockchain,
                contract,
                tokenId,
                keyword,
                assertionIds,
            );

            await this._updateAssetMetadata(
                currentRepository,
                assertionIds,
                ual,
                blockchain,
                contract,
                tokenId,
                keyword,
            );
        }
    }

    async _moveOldAssertionIds(
        currentRepository,
        historyRepository,
        blockchain,
        contract,
        tokenId,
        keyword,
        assertionIds,
    ) {
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

                if (currentRepository === TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT) {
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
        }
    }

    async _updateAssetMetadata(
        currentRepository,
        assertionIds,
        ual,
        blockchain,
        contract,
        tokenId,
        keyword,
    ) {
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

            if (currentRepository === TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT) {
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
        } else {
            await this.tripleStoreService.deleteAssetMetadata(
                currentRepository,
                blockchain,
                contract,
                tokenId,
            );
        }
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
