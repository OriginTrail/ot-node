import { formatAssertion } from 'assertion-tools';

import { SCHEMA_CONTEXT, TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

class TripleStoreService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.operationIdService = ctx.operationIdService;

        this.repositoryImplementations = {};
        for (const implementationName of this.tripleStoreModuleManager.getImplementationNames()) {
            for (const repository in this.tripleStoreModuleManager.getImplementation(
                implementationName,
            ).module.repositories) {
                this.repositoryImplementations[repository] = implementationName;
            }
        }
    }

    async localStoreAssertion(assertionId, operationId) {
        this.logger.info(`Inserting assertion with id: ${assertionId} in triple store.`);

        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);

        await this.tripleStoreModuleManager.insertAssertion(
            this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT],
            TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
            assertionId,
            assertion.join('\n'),
        );
    }

    async localStoreAsset(
        assertionId,
        blockchain,
        contract,
        tokenId,
        operationId,
        agreementStartTime,
        agreementEndTime,
        keyword,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.info(
            `Inserting asset with assertion id: ${assertionId}, ual: ${ual} in triple store.`,
        );

        /* // get current assertion, store current assertion in history repository, add triple UAL -> assertionId
        const assertionIds = await this.tripleStoreModuleManager.getAssetAssertionIds(
            this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            ual,
        );
        if (assertionIds?.length) {
            const currentAssertionId = assertionIds[0];
            let nquads = await this.tripleStoreModuleManager.getAssertion(
                this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                currentAssertionId,
            );
            nquads = await this.dataService.toNQuads(nquads, 'application/n-quads');

            const historyAssetNquads = await formatAssertion({
                '@context': SCHEMA_CONTEXT,
                '@id': ual,
                blockchain,
                contract,
                tokenId,
                assertion: { '@id': `assertion:${assertionId}` },
            });
            await Promise.all([
                this.tripleStoreModuleManager.insertAsset(
                    this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    ual,
                    historyAssetNquads.join('\n'),
                    false,
                ),
                this.tripleStoreModuleManager.insertAssertion(
                    this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    assertionId,
                    nquads,
                ),
            ]);

            const isAssertionIdShared = await this.tripleStoreModuleManager.isAssertionIdShared(
                this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                currentAssertionId,
            );
            if (!isAssertionIdShared) {
                // delete old assertion from current repository
                this.tripleStoreModuleManager.deleteAssertion(
                    this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    assertionId,
                );
            }
        } */

        // store new assertion in current repository, update triple UAL -> assertionId
        const currentAssetNquads = await formatAssertion({
            '@context': SCHEMA_CONTEXT,
            '@id': ual,
            blockchain,
            contract,
            tokenId,
            assertion: { '@id': `assertion:${assertionId}` },
            agreementStartTime,
            agreementEndTime,
            keyword,
        });
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);

        await Promise.all([
            this.tripleStoreModuleManager.insertAsset(
                this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                ual,
                currentAssetNquads.join('\n'),
            ),
            this.tripleStoreModuleManager.insertAssertion(
                this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
                TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                assertionId,
                assertion.join('\n'),
            ),
        ]);

        this.logger.info(
            `Asset with assertion id: ${assertionId}, ual: ${ual} has been successfully inserted!`,
        );
    }

    async localGet(assertionId, operationId) {
        this.logger.debug(`Getting assertion: ${assertionId} for operationId: ${operationId}`);

        let nquads = await this.tripleStoreModuleManager.getAssertion(
            this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT],
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            assertionId,
        );
        if (!nquads?.length) {
            nquads = await this.tripleStoreModuleManager.getAssertion(
                this.repositoryImplementations[TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY],
                TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
                assertionId,
            );
        }
        nquads = await this.dataService.toNQuads(nquads, 'application/n-quads');

        this.logger.debug(
            `Assertion: ${assertionId} for operationId: ${operationId} ${
                nquads.length ? '' : 'not'
            } found in local triple store.`,
        );

        if (nquads.length) {
            this.logger.debug(`Number of n-quads retrieved from the database : ${nquads.length}`);
        }

        return nquads;
    }

    async assetExists(repository, ual, blockchain, contract, tokenId) {
        return this.tripleStoreModuleManager.assetExists(
            this.repositoryImplementations[repository],
            repository,
            ual,
            blockchain,
            contract,
            tokenId,
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
}

export default TripleStoreService;
