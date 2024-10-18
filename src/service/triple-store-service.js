/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';
import { formatAssertion } from 'assertion-tools';

import { SCHEMA_CONTEXT, TRIPLE_STORE_REPOSITORIES, MEDIA_TYPES } from '../constants/constants.js';

class TripleStoreService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.paranetService = ctx.paranetService;
    }

    initializeRepositories() {
        this.repositoryImplementations = {};
        for (const implementationName of this.tripleStoreModuleManager.getImplementationNames()) {
            for (const repository in this.tripleStoreModuleManager.getImplementation(
                implementationName,
            ).module.repositories) {
                this.repositoryImplementations[repository] = implementationName;
            }
        }
    }

    async localStoreAsset(
        repository,
        assertionId,
        assertion,
        blockchain,
        contract,
        tokenId,
        keyword,
        retries = 1,
        retryDelay = 0,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.info(
            `Inserting Knowledge Asset with the UAL: ${ual}, Assertion ID: ${assertionId}, ` +
                `to the Triple Store's ${repository} repository.`,
        );

        const currentAssetNquads = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            blockchain,
            contract,
            tokenId,
            assertion: { '@id': `assertion:${assertionId}` },
            keyword,
        });

        const oldUalConnection = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': this.ualService.getUalWithoutChainId(ual, blockchain),
            assertion: { '@id': `assertion:${assertionId}` },
        });

        let attempts = 0;
        let success = false;

        const [currentAssetExists, assertionExists] = await Promise.all([
            this.tripleStoreModuleManager.assetExists(
                this.repositoryImplementations[repository],
                repository,
                ual,
            ),
            this.tripleStoreModuleManager.assertionExists(
                this.repositoryImplementations[repository],
                repository,
                assertionId,
            ),
        ]);

        while (attempts < retries && !success) {
            try {
                await Promise.all([
                    this.tripleStoreModuleManager.insertAssetAssertionMetadata(
                        this.repositoryImplementations[repository],
                        repository,
                        ual,
                        currentAssetNquads.join('\n'),
                        false,
                    ),
                    this.tripleStoreModuleManager.insertAssetAssertionMetadata(
                        this.repositoryImplementations[repository],
                        repository,
                        ual,
                        oldUalConnection.join('\n'),
                        false,
                    ),
                    this.tripleStoreModuleManager.insertAssertion(
                        this.repositoryImplementations[repository],
                        repository,
                        assertionId,
                        assertion.join('\n'),
                        false,
                    ),
                ]);

                success = true;

                this.logger.info(
                    `Knowledge Asset with UAL: ${ual}, Assertion ID: ${assertionId}, Repository: ${repository} has been successfully inserted.`,
                );
            } catch (error) {
                this.logger.error(
                    `Error during insertion. UAL: ${ual}, Assertion ID: ${assertionId}, Repository: ${repository}. Error: ${error.message}`,
                );
                attempts += 1;

                if (attempts < retries) {
                    this.logger.info(
                        `Retrying insertion attempt ${
                            attempts + 1
                        } of ${retries} after delay of ${retryDelay} ms. UAL: ${ual}, Assertion ID: ${assertionId}, Repository: ${repository}`,
                    );
                    await setTimeout(retryDelay);
                } else {
                    this.logger.error(
                        `Max retries reached. Rolling back data. UAL: ${ual}, Assertion ID: ${assertionId}, Repository: ${repository}`,
                    );

                    // Rollback insertions if data didn't exist before the operation
                    if (!currentAssetExists) {
                        this.logger.info(
                            `Rolling back asset metadata. UAL: ${ual}, Assertion ID: ${assertionId}, Repository: ${repository}`,
                        );
                        await this.deleteAssetMetadata(repository, blockchain, contract, tokenId);
                    }
                    if (!assertionExists) {
                        this.logger.info(
                            `Rolling back assertion data. UAL: ${ual}, Assertion ID: ${assertionId}, Repository: ${repository}`,
                        );
                        await this.deleteAssertion(repository, assertionId);
                    }

                    throw new Error(
                        `Failed to store asset after maximum retries. UAL: ${ual}, Assertion ID: ${assertionId}, Repository: ${repository}`,
                    );
                }
            }
        }
    }

    async moveAsset(
        fromRepository,
        toRepository,
        assertionId,
        blockchain,
        contract,
        tokenId,
        keyword,
    ) {
        let assertion;
        // Try-catch to prevent infinite processing loop when unexpected error is thrown while getting KA
        try {
            assertion = await this.getAssertion(fromRepository, assertionId);
        } catch (e) {
            this.logger.error(`Error while getting assertion for moving asset: ${e.message}`);
            return;
        }

        // copy metadata and assertion
        await this.localStoreAsset(
            toRepository,
            assertionId,
            assertion,
            blockchain,
            contract,
            tokenId,
            keyword,
        );

        const [assetsWithAssertionIdCount] = await this.countAssetsWithAssertionId(
            fromRepository,
            assertionId,
        );

        // delete assertion from repository if not linked to other assets
        if (assetsWithAssertionIdCount?.count <= 1) {
            await this.deleteAssertion(fromRepository, assertionId);
        }
    }

    async moveAssetWithoutDelete(
        fromRepository,
        toRepository,
        assertionId,
        blockchain,
        contract,
        tokenId,
        keyword,
    ) {
        let assertion;
        // Try-catch to prevent infinite processing loop when unexpected error is thrown while getting KA
        try {
            assertion = await this.getAssertion(fromRepository, assertionId);
        } catch (e) {
            this.logger.error(`Error while getting assertion for moving asset: ${e.message}`);
            return;
        }

        // copy metadata and assertion
        await this.localStoreAsset(
            toRepository,
            assertionId,
            assertion,
            blockchain,
            contract,
            tokenId,
            keyword,
        );
    }

    async insertAssetAssertionMetadata(
        repository,
        blockchain,
        contract,
        tokenId,
        assertionId,
        keyword,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.info(
            `Inserting metadata for the Knowledge Asset with the UAL: ${ual}, Assertion ID: ${assertionId}, ` +
                `to the Triple Store's ${repository} repository.`,
        );

        const currentAssetNquads = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            blockchain,
            contract,
            tokenId,
            assertion: { '@id': `assertion:${assertionId}` },
            keyword,
        });

        await this.tripleStoreModuleManager.insertAssetAssertionMetadata(
            this.repositoryImplementations[repository],
            repository,
            ual,
            currentAssetNquads.join('\n'),
        );
    }

    async updateAssetNonAssertionMetadata(repository, blockchain, contract, tokenId, keyword) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.info(
            `Updating Non-Assertion metadata for the Knowledge Asset with the UAL: ${ual} ` +
                `in the Triple Store's ${repository} repository.`,
        );

        const updatedAssetNquads = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            blockchain,
            contract,
            tokenId,
            keyword,
        });

        await this.tripleStoreModuleManager.updateAssetNonAssertionMetadata(
            this.repositoryImplementations[repository],
            repository,
            ual,
            updatedAssetNquads.join('\n'),
        );
    }

    async deleteAssetMetadata(repository, blockchain, contract, tokenId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.info(
            `Deleting metadata for the Knowledge Asset with the UAL: ${ual} ` +
                `from the Triple Store's ${repository} repository.`,
        );

        const assertionLinks = await this.getAssetAssertionLinks(
            repository,
            blockchain,
            contract,
            tokenId,
        );
        const linkedAssertionIds = assertionLinks.map(({ assertion }) =>
            assertion.replace('assertion:', ''),
        );

        await this.tripleStoreModuleManager.deleteAssetMetadata(
            this.repositoryImplementations[repository],
            repository,
            ual,
        );
        await this.tripleStoreModuleManager.deleteAssetMetadata(
            this.repositoryImplementations[repository],
            repository,
            this.ualService.getUalWithoutChainId(ual, blockchain),
        );

        // Delete assertions that were linked only to this Knowledge Asset
        for (const linkedAssertionId of linkedAssertionIds) {
            // eslint-disable-next-line no-await-in-loop
            const [assetsWithAssertionIdCount] = await this.countAssetsWithAssertionId(
                repository,
                linkedAssertionId,
            );

            if (assetsWithAssertionIdCount?.count === 0) {
                // eslint-disable-next-line no-await-in-loop
                await this.deleteAssertion(repository, linkedAssertionId);
            }
        }
    }

    async deleteAssertion(repository, assertionId) {
        this.logger.info(
            `Deleting Assertion with the ID: ${assertionId} from the Triple Store's ${repository} repository.`,
        );
        return this.tripleStoreModuleManager.deleteAssertion(
            this.repositoryImplementations[repository],
            repository,
            assertionId,
        );
    }

    async countAssetsWithAssertionId(repository, assertionId) {
        const bindings = await this.tripleStoreModuleManager.countAssetsWithAssertionId(
            this.repositoryImplementations[repository],
            repository,
            assertionId,
        );
        const count = this.dataService.parseBindings(bindings);
        if (count > 1) {
            // since 6.1.0 in asset metadata we are storing two triples connected to assertion id
            // using 2 formats of ual - so we can expect that this query returns 2 triples per asset
            return Math.round(count / 2);
        }
        return count;
    }

    async getAssertion(repository, assertionId) {
        this.logger.debug(
            `Getting Assertion with the ID: ${assertionId} from the Triple Store's ${repository} repository.`,
        );
        let nquads = await this.tripleStoreModuleManager.getAssertion(
            this.repositoryImplementations[repository],
            repository,
            assertionId,
        );
        nquads = await this.dataService.toNQuads(nquads, MEDIA_TYPES.N_QUADS);

        this.logger.debug(
            `Assertion: ${assertionId} ${
                nquads.length ? '' : 'is not'
            } found in the Triple Store's ${repository} repository.`,
        );

        if (nquads.length) {
            this.logger.debug(
                `Number of n-quads retrieved from the Triple Store's ${repository} repository: ${nquads.length}.`,
            );
        }

        return nquads;
    }

    async assetExists(repository, blockchain, contract, tokenId) {
        return this.tripleStoreModuleManager.assetExists(
            this.repositoryImplementations[repository],
            repository,
            this.ualService.deriveUAL(blockchain, contract, tokenId),
        );
    }

    async paranetAssetExists(blockchain, kaContract, kaTokenId, paranetContract, paranetTokenId) {
        const paranetUAL = this.ualService.deriveUAL(blockchain, paranetContract, paranetTokenId);
        const repository = this.paranetService.getParanetRepositoryName(paranetUAL);
        return this.assetExists(repository, blockchain, kaContract, kaTokenId);
    }

    async insertAssetAssertionLink(repository, blockchain, contract, tokenId, assertionId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.info(
            `Inserting Link to the Assertion with the ID: ${assertionId} for the Knowledge Asset with the UAL: ${ual} ` +
                `to the Triple Store's ${repository} repository.`,
        );

        return this.tripleStoreModuleManager.insertAssetAssertionLink(
            this.repositoryImplementations[repository],
            repository,
            ual,
            assertionId,
        );
    }

    async updateAssetAssertionLink(
        repository,
        blockchain,
        contract,
        tokenId,
        oldAssertionId,
        newAssertionId,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.info(
            `Updating Assertion for the Knowledge Asset with the UAL: ${ual} in the Triple Store's ${repository} repository. ` +
                `Old Assertion ID: ${oldAssertionId}. New Assertion ID: ${newAssertionId}.`,
        );

        await this.tripleStoreModuleManager.updateAssetAssertionLink(
            this.repositoryImplementations[repository],
            repository,
            ual,
            oldAssertionId,
            newAssertionId,
        );

        const [assetsWithAssertionIdCount] = await this.countAssetsWithAssertionId(
            repository,
            oldAssertionId,
        );

        // Delete old assertion if it was only linked to this Knowledge Asset
        if (assetsWithAssertionIdCount?.count === 0) {
            await this.deleteAssertion(repository, oldAssertionId);
        }
    }

    async deleteAssetAssertionLink(repository, blockchain, contract, tokenId, assertionId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.info(
            `Deleting Link to the Assertion with the ID: ${assertionId} for the Knowledge Asset with the UAL: ${ual} ` +
                `from the Triple Store's ${repository} repository.`,
        );

        await this.tripleStoreModuleManager.deleteAssetAssertionLink(
            this.repositoryImplementations[repository],
            repository,
            ual,
            assertionId,
        );

        const [assetsWithAssertionIdCount] = await this.countAssetsWithAssertionId(
            repository,
            assertionId,
        );

        // Delete assertion if it was only linked to this Knowledge Asset
        if (assetsWithAssertionIdCount?.count === 0) {
            await this.deleteAssertion(repository, assertionId);
        }
    }

    async getAssetAssertionLinks(repository, blockchain, contract, tokenId) {
        const bindings = await this.tripleStoreModuleManager.getAssetAssertionLinks(
            this.repositoryImplementations[repository],
            repository,
            this.ualService.deriveUAL(blockchain, contract, tokenId),
        );
        return this.dataService.parseBindings(bindings);
    }

    async assetAssertionLinkExists(repository, blockchain, contract, tokenId, assertionId) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        return this.tripleStoreModuleManager.assetAssertionLinkExists(
            this.repositoryImplementations[repository],
            repository,
            ual,
            assertionId,
        );
    }

    async assertionExists(repository, assertionId) {
        return this.tripleStoreModuleManager.assertionExists(
            this.repositoryImplementations[repository],
            repository,
            assertionId,
        );
    }

    async construct(repository, query) {
        return this.tripleStoreModuleManager.construct(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async select(repository, query) {
        return this.tripleStoreModuleManager.select(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async queryVoid(repository, query) {
        return this.tripleStoreModuleManager.queryVoid(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async queryVoidAllRepositories(query) {
        const queryPromises = [];
        for (const repository in TRIPLE_STORE_REPOSITORIES) {
            queryPromises.push(
                this.tripleStoreModuleManager.queryVoid(
                    this.repositoryImplementations[repository],
                    TRIPLE_STORE_REPOSITORIES[repository],
                    query,
                ),
            );
        }

        return Promise.all(queryPromises);
    }
}

export default TripleStoreService;
