/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import { TRIPLE_STORE } from '../constants/constants.js';

class PrivateAssetsMetadataMigration extends BaseMigration {
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
        const graphs = await this.tripleStoreService.select(
            TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
            `SELECT DISTINCT ?g 
                    WHERE {
                        GRAPH ?g { ?s ?p ?o }
                    }`,
        );

        const assertionIds = (graphs ?? [])
            .filter(({ g }) => g.startsWith('assertion:'))
            .map(({ g }) => g.replace('assertion:', ''));

        if (!assertionIds?.length) {
            this.logger.debug(
                `No assertions found in ${TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT} repository. Skipping migration.`,
            );
            return;
        }

        this.logger.debug(
            `${assertionIds.length} assertions found in ${TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT} repository.`,
        );
        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            const assetStorageContractAddresses =
                this.blockchainModuleManager.getAssetStorageContractAddresses();

            for (const assetStorageContractAddress of assetStorageContractAddresses) {
                const latestTokenId = Number(
                    await this.blockchainModuleManager.getLatestTokenId(
                        blockchain,
                        assetStorageContractAddress,
                    ),
                );

                this.logger.debug(
                    `Getting latest asset metadata from blockchain: ${blockchain}, asset storage contract address: ${assetStorageContractAddress}, from tokenId 0 to tokenId ${latestTokenId}`,
                );
                const concurrency = 100;
                let promises = [];
                for (let tokenId = 0; tokenId < latestTokenId; tokenId += 1) {
                    promises.push(
                        this._migrateAssertions(
                            blockchain,
                            assetStorageContractAddress,
                            tokenId,
                            latestTokenId,
                            assertionIds,
                        ),
                    );
                    if (promises.length > concurrency) {
                        // eslint-disable-next-line no-await-in-loop
                        await Promise.all(promises);
                        promises = [];
                    }
                }
                await Promise.all(promises);
            }
        }
    }

    async _migrateAssertions(
        blockchain,
        assetStorageContractAddress,
        tokenId,
        latestTokenId,
        assertionIds,
    ) {
        this._logPercentage(tokenId, latestTokenId);
        let assertionId;
        try {
            assertionId = await this.blockchainModuleManager.getLatestAssertionId(
                blockchain,
                assetStorageContractAddress,
                tokenId,
            );
        } catch (error) {
            this.logger.warn(`Unable to find assertion id for token id: ${tokenId}`);
            return;
        }
        if (!assertionIds.includes(assertionId)) return;

        this.logger.debug(
            `Getting latest metadata for asset with token id: ${tokenId}, assertion id: ${assertionId}, blockchain: ${blockchain}, asset storage contract address: ${assetStorageContractAddress}`,
        );

        const keyword = await this.ualService.calculateLocationKeyword(
            blockchain,
            assetStorageContractAddress,
            tokenId,
        );

        await this.tripleStoreService.insertAssetAssertionMetadata(
            TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
            blockchain,
            assetStorageContractAddress,
            tokenId,
            assertionId,
            keyword,
        );

        const assertion = await this.tripleStoreService.getAssertion(
            TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
            assertionId,
        );

        const privateAssertionId = this.dataService.getPrivateAssertionId(assertion);

        if (privateAssertionId == null || !assertionIds.includes(privateAssertionId)) return;

        await this.tripleStoreService.insertAssetAssertionMetadata(
            TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
            blockchain,
            assetStorageContractAddress,
            tokenId,
            privateAssertionId,
            keyword,
        );
    }

    _logPercentage(index, max) {
        const previousPercentage = (Math.max(0, index - 1) / max) * 100;
        const currentPercentage = (index / max) * 100;

        if (Math.floor(currentPercentage) - Math.floor(previousPercentage) < 1) return;

        this.logger.debug(`Migration at ${Math.floor(currentPercentage * 10) / 10}%`);
    }
}

export default PrivateAssetsMetadataMigration;
