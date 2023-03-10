/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    TRIPLE_STORE_REPOSITORIES,
} from '../constants/constants.js';

const PRIVATE_ASSERTION_PREDICATE = 'https://ontology.origintrail.io/dkg/1.0#privateAssertionID';

class PrivateAssetsMetadataMigration extends BaseMigration {
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
        const graphs = await this.tripleStoreService.select(
            TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
            `SELECT DISTINCT ?g 
                    WHERE {
                        GRAPH ?g { ?s ?p ?o }
                    }`,
        );

        const assertionIds = (graphs ?? [])
            .filter(({ g }) => g.startsWith('assertion:'))
            .map(({ g }) => g.replace('assertion:', ''));

        if (!assertionIds?.length) return;

        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            const assetStorageContractAddresses =
                this.blockchainModuleManager.getAssetStorageContractAddresses();

            for (const assetStorageContractAddress of assetStorageContractAddresses) {
                const latestTokenId = await this.blockchainModuleManager.getLatestTokenId(
                    blockchain,
                    assetStorageContractAddress,
                );

                for (let tokenId = 0; tokenId < Number(latestTokenId); tokenId += 1) {
                    const assertionId = await this.blockchainModuleManager.getLatestAssertionId(
                        blockchain,
                        assetStorageContractAddress,
                        tokenId,
                    );

                    if (!assertionIds.includes(assertionId)) continue;

                    const keyword = await this.ualService.calculateLocationKeyword(
                        blockchain,
                        assetStorageContractAddress,
                        tokenId,
                    );
                    const agreementId = await this.serviceAgreementService.generateId(
                        blockchain,
                        assetStorageContractAddress,
                        tokenId,
                        keyword,
                        CONTENT_ASSET_HASH_FUNCTION_ID,
                    );
                    const agreementData = await this.blockchainModuleManager.getAgreementData(
                        blockchain,
                        agreementId,
                    );

                    const agreementEndTime =
                        agreementData.startTime +
                        agreementData.epochsNumber * agreementData.epochLength;

                    await this.tripleStoreService.insertAssetMetadata(
                        TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                        blockchain,
                        assetStorageContractAddress,
                        tokenId,
                        assertionId,
                        agreementData.startTime,
                        agreementEndTime,
                        keyword,
                    );

                    const assertion = await this.tripleStoreService.getAssertion(
                        TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                        assertionId,
                    );
                    const privateAssertionLinkTriple = assertion.filter((triple) =>
                        triple.includes(PRIVATE_ASSERTION_PREDICATE),
                    )[0];
                    if (!privateAssertionLinkTriple) continue;

                    const privateAssertionId = privateAssertionLinkTriple.match(/"(.*?)"/)[1];

                    if (!assertionIds.includes(privateAssertionId)) continue;
                    await this.tripleStoreService.insertAssetMetadata(
                        TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                        blockchain,
                        assetStorageContractAddress,
                        tokenId,
                        privateAssertionId,
                        agreementData.startTime,
                        agreementEndTime,
                        keyword,
                    );
                }
            }
        }
    }
}

export default PrivateAssetsMetadataMigration;
