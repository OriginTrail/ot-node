/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    TRIPLE_STORE_REPOSITORIES,
} from '../constants/constants.js';

const ASSET_STORAGE_CONTRACT_ADDRESS = '0x5cAC41237127F94c2D21dAe0b14bFeFa99880630';
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
            .map(({ g }) => g);

        if (!assertionIds?.length) return;

        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            const latestTokenId = await this.blockchainModuleManager.getLatestTokenId(
                blockchain,
                ASSET_STORAGE_CONTRACT_ADDRESS,
            );
            for (let tokenId = 0; tokenId < Number(latestTokenId); tokenId += 1) {
                const assertionId = await this.blockchainModuleManager.getLatestAssertionId(
                    blockchain,
                    ASSET_STORAGE_CONTRACT_ADDRESS,
                    tokenId,
                );

                if (!assertionIds.includes(assertionId)) continue;

                const keyword = await this.ualService.calculateLocationKeyword(
                    blockchain,
                    ASSET_STORAGE_CONTRACT_ADDRESS,
                    tokenId,
                );
                const agreementId = await this.serviceAgreementService.generateId(
                    blockchain,
                    ASSET_STORAGE_CONTRACT_ADDRESS,
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
                    ASSET_STORAGE_CONTRACT_ADDRESS,
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

                await this.tripleStoreService.insertAssetMetadata(
                    TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                    blockchain,
                    ASSET_STORAGE_CONTRACT_ADDRESS,
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

export default PrivateAssetsMetadataMigration;
