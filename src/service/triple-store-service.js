/* eslint-disable no-await-in-loop */
import { setTimeout } from 'timers/promises';

import {
    BASE_NAMED_GRAPHS,
    TRIPLE_STORE_REPOSITORY,
    TRIPLES_VISIBILITY,
    PRIVATE_HASH_SUBJECT_PREFIX,
} from '../constants/constants.js';

class TripleStoreService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.operationIdService = ctx.operationIdService;
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

    async insertKnowledgeCollection(
        repository,
        knowledgeCollectionUAL,
        triples,
        retries = 1,
        retryDelay = 0,
    ) {
        this.logger.info(
            `Inserting Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                `to the Triple Store's ${repository} repository.`,
        );

        const existsInNamedGraphs =
            await this.tripleStoreModuleManager.knowledgeCollectionNamedGraphsExist(
                this.repositoryImplementations[repository],
                repository,
                knowledgeCollectionUAL,
            );

        // TODO: Add with the introduction of RDF-star mode
        // const tripleAnnotations = this.dataService.createTripleAnnotations(
        //     knowledgeAssetsTriples,
        //     UAL_PREDICATE,
        //     knowledgeAssetsUALs.map((ual) => `<${ual}>`),
        // );
        // const unifiedGraphTriples = [...triples, ...tripleAnnotations];
        const publicKnowledgeAssetsTriples = this.dataService.splitConnectedArrays(
            triples.public ?? triples,
        );

        const publicKnowledgeAssetsUALs = [];
        for (let i = 1; i <= publicKnowledgeAssetsTriples.length; i += 1) {
            publicKnowledgeAssetsUALs.push(`${knowledgeCollectionUAL}/${i}`);
        }
        const promises = [];

        if (triples.private?.length && !existsInNamedGraphs) {
            const privateKnowledgeAssetsTriples = this.dataService.groupTriplesBySubject(
                triples.private,
            );
            const privateKnowledgeAssetsUALs = [];
            let publicIndex = 0;
            let privateIndex = 0;
            while (
                publicIndex < publicKnowledgeAssetsTriples.length &&
                privateIndex < privateKnowledgeAssetsTriples.length
            ) {
                // const [privateSubject] = privateKnowledgeAssetsTriples[privateIndex][0].split(' ');
                // Check if first triple is content or private existence identifier
                if (
                    this.dataService.quadsContainsPrivateRepresentations(
                        publicKnowledgeAssetsTriples[publicIndex],
                    )
                ) {
                    privateKnowledgeAssetsUALs.push(publicKnowledgeAssetsUALs[publicIndex]);
                    privateIndex += 1;
                }
                publicIndex += 1;
            }

            if (privateKnowledgeAssetsUALs.length > 0) {
                promises.push(
                    this.tripleStoreModuleManager.createKnowledgeCollectionNamedGraphs(
                        this.repositoryImplementations[repository],
                        repository,
                        privateKnowledgeAssetsUALs,
                        privateKnowledgeAssetsTriples,
                        TRIPLES_VISIBILITY.PRIVATE,
                    ),
                );
            }
        }
        if (!existsInNamedGraphs) {
            promises.push(
                this.tripleStoreModuleManager.createKnowledgeCollectionNamedGraphs(
                    this.repositoryImplementations[repository],
                    repository,
                    publicKnowledgeAssetsUALs,
                    publicKnowledgeAssetsTriples,
                    TRIPLES_VISIBILITY.PUBLIC,
                ),
            );
        }
        const metadataTriples = publicKnowledgeAssetsUALs
            .map((ual) => `<${ual}> <http://schema.org/states> "${ual}:0" .`)
            .join('\n');

        promises.push(
            this.tripleStoreModuleManager.insertKnowledgeCollectionMetadata(
                this.repositoryImplementations[repository],
                repository,
                metadataTriples,
            ),
        );

        let attempts = 0;
        let success = false;

        while (attempts < retries && !success) {
            try {
                await Promise.all(promises);

                success = true;

                this.logger.info(
                    `Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                        `has been successfully inserted to the Triple Store's ${repository} repository.`,
                );
            } catch (error) {
                this.logger.error(
                    `Error during insertion of the Knowledge Collection to the Triple Store's ${repository} repository. ` +
                        `UAL: ${knowledgeCollectionUAL}. Error: ${error.message}`,
                );
                attempts += 1;

                if (attempts < retries) {
                    this.logger.info(
                        `Retrying insertion of the Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                            `to the Triple Store's ${repository} repository. Attempt ${
                                attempts + 1
                            } of ${retries} after delay of ${retryDelay} ms.`,
                    );
                    await setTimeout(retryDelay);
                } else {
                    this.logger.error(
                        `Max retries reached for the insertion of the Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                            `to the Triple Store's ${repository} repository. Rolling back data.`,
                    );

                    if (!existsInNamedGraphs) {
                        this.logger.info(
                            `Rolling back Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                                `from the Triple Store's ${repository} repository Named Graphs.`,
                        );
                        await this.tripleStoreModuleManager.deleteKnowledgeCollectionNamedGraphs(
                            this.repositoryImplementations[repository],
                            repository,
                            publicKnowledgeAssetsUALs,
                        );
                    }

                    throw new Error(
                        `Failed to store Knowledge Collection with the UAL: ${knowledgeCollectionUAL} ` +
                            `to the Triple Store's ${repository} repository after maximum retries.`,
                    );
                }
            }
        }
    }

    async insertUpdatedKnowledgeCollection(preUpdateUalNamedGraphs, ual, triples, firstNewKAIndex) {
        const preUpdateSubjectUalMap = new Map(
            preUpdateUalNamedGraphs.map((entry) => [
                entry.subject,
                entry.g.split('/').slice(0, -1).join('/'),
            ]),
        );

        const publicKnowledgeAssetsTriples = this.dataService.groupTriplesBySubject(
            triples.public ?? triples,
        );

        const publicKnowledgeAssetsSubjects = publicKnowledgeAssetsTriples.map(
            ([triple]) => triple.split(' ')[0],
        );
        const publicKnowledgeAssetsStatesUALs = [];
        let newKnowledgeAssetId = firstNewKAIndex;
        for (const subject of publicKnowledgeAssetsSubjects) {
            if (preUpdateSubjectUalMap.has(subject)) {
                publicKnowledgeAssetsStatesUALs.push(preUpdateSubjectUalMap.get(subject));
            } else {
                publicKnowledgeAssetsStatesUALs.push(`${ual}/${newKnowledgeAssetId}`);
                newKnowledgeAssetId += 1;
            }
        }

        const promises = [];

        promises.push(
            this.tripleStoreModuleManager.createKnowledgeCollectionNamedGraphs(
                this.repositoryImplementations[TRIPLE_STORE_REPOSITORY.DKG],
                TRIPLE_STORE_REPOSITORY.DKG,
                publicKnowledgeAssetsStatesUALs,
                publicKnowledgeAssetsTriples,
                TRIPLES_VISIBILITY.PUBLIC,
            ),
        );

        if (triples.private?.length) {
            const privateKnowledgeAssetsTriples = this.dataService.groupTriplesBySubject(
                triples.private,
            );

            const publicSubjectsMap = new Map(
                publicKnowledgeAssetsTriples.map(([triple], index) => {
                    const [subject] = triple.split(' ');
                    return [subject, index];
                }),
            );

            const privateKnowledgeAssetsStatesUALs = privateKnowledgeAssetsTriples.reduce(
                (result, [triple]) => {
                    const [privateSubject] = triple.split(' '); // groupTriplesBySubject guarantees format
                    if (publicSubjectsMap.has(privateSubject)) {
                        result.push(
                            publicKnowledgeAssetsStatesUALs[publicSubjectsMap.get(privateSubject)],
                        );
                    }
                    return result;
                },
                [],
            );

            if (privateKnowledgeAssetsStatesUALs.length > 0) {
                promises.push(
                    this.tripleStoreModuleManager.createKnowledgeCollectionNamedGraphs(
                        this.repositoryImplementations[TRIPLE_STORE_REPOSITORY.DKG],
                        TRIPLE_STORE_REPOSITORY.DKG,
                        privateKnowledgeAssetsStatesUALs,
                        privateKnowledgeAssetsTriples,
                        TRIPLES_VISIBILITY.PRIVATE,
                    ),
                );
            }
        }
    }

    async moveKnowledgeCollectionBetweenUnifiedGraphs(fromRepository, toRepository, ual) {
        const knowledgeCollection =
            await this.tripleStoreModuleManager.getKnowledgeCollectionFromUnifiedGraph(
                this.repositoryImplementations[fromRepository],
                fromRepository,
                BASE_NAMED_GRAPHS.UNIFIED,
                ual,
                false,
            );

        // TODO: Add with the introduction of the RDF-star mode
        // const knowledgeCollectionAnnotations = this.dataService.createTripleAnnotations(
        //     knowledgeCollection,
        //     UAL_PREDICATE,
        //     `<${ual}>`,
        // );
        // const knowledgeCollectionWithAnnotations = [
        //     ...knowledgeCollection,
        //     ...knowledgeCollectionAnnotations,
        // ];

        await Promise.all([
            this.tripleStoreModuleManager.insetAssertionInNamedGraph(
                this.repositoryImplementations[toRepository],
                toRepository,
                BASE_NAMED_GRAPHS.HISTORICAL_UNIFIED,
                knowledgeCollection,
            ),
            this.tripleStoreModuleManager.deleteUniqueKnowledgeCollectionTriplesFromUnifiedGraph(
                this.repositoryImplementations[toRepository],
                toRepository,
                BASE_NAMED_GRAPHS.UNIFIED,
                ual,
            ),
        ]);
    }

    async checkIfKnowledgeCollectionExistsInUnifiedGraph(
        ual,
        repository = TRIPLE_STORE_REPOSITORY.DKG,
    ) {
        const knowledgeCollectionExists =
            await this.tripleStoreModuleManager.knowledgeCollectionExistsInUnifiedGraph(
                this.repositoryImplementations[repository],
                repository,
                BASE_NAMED_GRAPHS.UNIFIED,
                ual,
            );

        return knowledgeCollectionExists;
    }

    async getAssertion(
        blockchain,
        contract,
        knowledgeCollectionId,
        knowledgeAssetId,
        visibility = TRIPLES_VISIBILITY.PUBLIC,
        repository = TRIPLE_STORE_REPOSITORY.DKG,
    ) {
        // TODO: Use stateId
        const ual = `did:dkg:${blockchain}/${contract}/${knowledgeCollectionId}${
            knowledgeAssetId ? `/${knowledgeAssetId}` : ''
        }`;

        this.logger.debug(`Getting Assertion with the UAL: ${ual}.`);

        let nquads;
        if (knowledgeAssetId) {
            nquads = await this.tripleStoreModuleManager.getNamedGraph(
                this.repositoryImplementations[repository],
                repository,
                // TODO: Add state with implemented update
                `${ual}:0`,
                visibility,
            );
        } else {
            nquads = await this.tripleStoreModuleManager.getKnowledgeCollectionNamedGraphs(
                this.repositoryImplementations[repository],
                repository,
                ual,
                visibility,
            );
        }

        nquads = nquads.split('\n').filter((line) => line !== '');

        this.logger.debug(
            `Assertion: ${ual} ${
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

    async getAssertionMetadata(
        blockchain,
        contract,
        knowledgeCollectionId,
        knowledgeAssetId,
        repository = TRIPLE_STORE_REPOSITORY.DKG,
    ) {
        const ual = `did:dkg:${blockchain}/${contract}/${knowledgeCollectionId}${
            knowledgeAssetId ? `/${knowledgeAssetId}` : ''
        }`;
        this.logger.debug(`Getting Assertion Metadata with the UAL: ${ual}.`);
        let nquads;
        if (knowledgeAssetId) {
            nquads = await this.tripleStoreModuleManager.getKnowledgeAssetMetadata(
                this.repositoryImplementations[repository],
                repository,
                ual,
            );
        } else {
            nquads = await this.tripleStoreModuleManager.getKnowledgeCollectionMetadata(
                this.repositoryImplementations[repository],
                repository,
                ual,
            );
        }
        nquads = nquads.split('\n').filter((line) => line !== '');

        this.logger.debug(
            `Knowledge Asset Metadata: ${ual} ${
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

    async construct(query, repository = TRIPLE_STORE_REPOSITORY.DKG) {
        return this.tripleStoreModuleManager.construct(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async moveToHistoricAndDeleteAssertion(ual, stateIndex) {
        // Find all named graph that exist for given UAL
        const ualNamedGraphs = await this.findAllNamedGraphsByUAL(TRIPLE_STORE_REPOSITORY.DKG, ual);
        let stateNamedGraphExistInHistoric = [];
        const ulaNamedGraphsWithState = [];
        const checkPromises = [];
        // Check if they already exist in historic
        for (const ulaNamedGraph of ualNamedGraphs) {
            const parts = ulaNamedGraph.split('/');
            parts[parts.length - 2] = `${parts[parts.length - 2]}:${stateIndex}`;
            const ulaNamedGraphWithState = parts.join('/');
            ulaNamedGraphsWithState.push(ulaNamedGraphWithState);
            checkPromises.push(
                this.tripleStoreModuleManager.namedGraphExist(
                    this.repositoryImplementations[TRIPLE_STORE_REPOSITORY.DKG_HISTORIC],
                    TRIPLE_STORE_REPOSITORY.DKG_HISTORIC,
                    ulaNamedGraphWithState,
                ),
            );
        }
        stateNamedGraphExistInHistoric = await Promise.all(checkPromises);
        // const insertPromises = [];

        // Insert them in UAL:latestStateIndex - 1 named graph in historic
        for (const [index, promiseResult] of stateNamedGraphExistInHistoric.entries()) {
            if (!promiseResult) {
                const nquads = await this.tripleStoreModuleManager.getAssertionFromNamedGraph(
                    this.repositoryImplementations[TRIPLE_STORE_REPOSITORY.DKG],
                    TRIPLE_STORE_REPOSITORY.DKG,
                    ualNamedGraphs[index],
                );
                await this.tripleStoreModuleManager.insetAssertionInNamedGraph(
                    this.repositoryImplementations[TRIPLE_STORE_REPOSITORY.DKG_HISTORIC],
                    TRIPLE_STORE_REPOSITORY.DKG_HISTORIC,
                    ulaNamedGraphsWithState[index],
                    nquads,
                );
            }
        }

        await this.tripleStoreModuleManager.deleteKnowledgeCollectionNamedGraphs(
            TRIPLE_STORE_REPOSITORY.DKG,
            ualNamedGraphs,
        );

        return ualNamedGraphs;
    }

    async findAllNamedGraphsByUAL(repositories, ual) {
        return this.tripleStoreModuleManager.findAllNamedGraphsByUAL(
            this.repositoryImplementations[repositories],
            repositories,
            ual,
        );
    }

    async findAllSubjectsWithGraphNames(repositories, ual) {
        const unparsedSubjectUALPairs = this.tripleStoreModuleManager.findAllSubjectsWithGraphNames(
            this.repositoryImplementations[repositories],
            repositories,
            ual,
        );

        const subjectUALPairs = Array.from(
            unparsedSubjectUALPairs.reduce((map, { s, g }) => {
                let pair = { subject: null, subjectHash: null, ual: g };
                if (map.has(g)) {
                    pair = map.get(g);
                }
                if (s) {
                    if (s.startsWith(`<${PRIVATE_HASH_SUBJECT_PREFIX}`)) {
                        pair.subjectHash = s;
                    } else {
                        pair.subject = s;
                    }
                }
                map.set(g, pair);
                return map;
            }, new Map()),
        ).values();

        return subjectUALPairs;
    }

    async getKnowledgeAssetNamedGraph(repository, ual, visibility) {
        return this.tripleStoreModuleManager.getKnowledgeAssetNamedGraph(
            this.repositoryImplementations[repository],
            repository,
            ual,
            visibility,
        );
    }

    async select(query, repository = TRIPLE_STORE_REPOSITORY.DKG) {
        return this.tripleStoreModuleManager.select(
            this.repositoryImplementations[repository],
            repository,
            query,
        );
    }

    async queryVoid(repository, query, namedGraphs = null, labels = null) {
        return this.tripleStoreModuleManager.queryVoid(
            this.repositoryImplementations[repository],
            repository,
            this.buildQuery(query, namedGraphs, labels),
        );
    }
}

export default TripleStoreService;
