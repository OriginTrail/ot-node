/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import { TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

const repository = TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT;

class UpdateServiceAgreementEndTimeMigration extends BaseMigration {
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
        await this.updateEndTimestamp();
        await this.addResourceId();
    }

    async updateEndTimestamp() {
        // find all keywords for assertions with NaN in end timestamp
        const query = `PREFIX schema: <http://schema.org/>
SELECT ?s ?p ?o WHERE {
    ?s schema:agreementEndTime ?agreementEndTime .
    ?s ?p ?o .
    filter contains(?agreementEndTime,"NaN")
    filter (?p=schema:keyword )
}`;

        const keywordTriples = await this.tripleStoreService.select(repository, query);
        let ual;
        let agreementId;
        this.logger.debug(
            `Found ${keywordTriples.length} service agreement with invalid end timestamp.`,
        );
        for (const keywordTriple of keywordTriples) {
            try {
                ual = keywordTriple.s;
                const keyword = keywordTriple.o.split('"').join('');
                const hashFunctionId = 1;
                const resolvedUal = this.ualService.resolveUAL(ual);

                agreementId = await this.serviceAgreementService.generateId(
                    resolvedUal.contract,
                    resolvedUal.tokenId,
                    keyword,
                    hashFunctionId,
                );

                const agreementData = await this.blockchainModuleManager.getAgreementData(
                    resolvedUal.blockchain,
                    agreementId,
                );

                const agreementEndTime =
                    agreementData.startTime +
                    agreementData.epochsNumber * agreementData.epochLength;

                const updateQuery = `
PREFIX schema: <http://schema.org/>
delete where { <${ual}> schema:agreementEndTime ?anyObject };
INSERT DATA
{ GRAPH <assets:graph> { <${ual}>  schema:agreementEndTime  ${agreementEndTime} } }`;

                await this.tripleStoreService.update(repository, updateQuery);
                this.logger.trace(`Updated service agreement ${agreementId} end timestamp.`);
            } catch (error) {
                this.logger.warn(
                    `Error while trying to update end timestamp for agreement id: ${agreementId}, ual: ${ual}. Error: ${error.message}`,
                );
            }
        }
    }

    async addResourceId() {
        this.logger.debug(`Updating resource id in metadata`);
        const getAssertionIdsQuery = `PREFIX schema: <http://schema.org/>
SELECT ?s ?o WHERE {
    ?s schema:assertion ?o
}
`;

        const asertionTriples = await this.tripleStoreService.select(
            repository,
            getAssertionIdsQuery,
        );

        for (const assertionTriple of asertionTriples) {
            let ual;
            try {
                ual = assertionTriple.s;
                const assertionId = assertionTriple.o;

                const getResourceIdQuery = `select distinct ?s where {
    graph <${assertionId}> 
    {?s ?p ?o . FILTER NOT EXISTS {?object ?predicate ?s .}}}`;

                const resourceIds = await this.tripleStoreService.select(
                    repository,
                    getResourceIdQuery,
                );
                if (resourceIds && resourceIds[0]?.s) {
                    let insertData = null;

                    resourceIds.forEach((resourceId) => {
                        const nquad = `<${ual}>  schema:hasResourceId  <${resourceId[0].s}>`;
                        insertData = insertData ? `${insertData} . ${nquad}` : nquad;
                    });
                    const updateQuery = `PREFIX schema: <http://schema.org/>
delete where { <${ual}> schema:hasResourceId ?anyObject };
INSERT DATA
{ GRAPH <assets:graph> { ${insertData} } }`;
                    await this.tripleStoreService.update(repository, updateQuery);
                }
            } catch (error) {
                this.logger.warn(
                    `Unable to add resource id for ual: ${ual}.Error message: ${error.message}`,
                );
            }
        }
    }
}

export default UpdateServiceAgreementEndTimeMigration;
