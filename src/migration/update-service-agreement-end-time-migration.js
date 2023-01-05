/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';

class UpdateServiceAgreementEndTimeMigration extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        tripleStoreModuleManager,
        blockchainModuleManager,
        serviceAgreementService,
        ualService,
    ) {
        super(migrationName, logger, config);
        this.tripleStoreModuleManager = tripleStoreModuleManager;
        this.blockchainModuleManager = blockchainModuleManager;
        this.serviceAgreementService = serviceAgreementService;
        this.ualService = ualService;
    }

    async executeMigration() {
        // find all Nan assertion ids
        const query = `PREFIX schema: <http://schema.org/>
SELECT ?s ?p ?o WHERE {
    ?s schema:agreementEndTime ?agreementEndTime .
    ?s ?p ?o .
    filter contains(?agreementEndTime,"NaN")
    filter (?p=schema:keyword )
}`;

        const results = await this.tripleStoreModuleManager.select(query);
        let ual;
        let agreementId;
        this.logger.debug(`Found ${results.length} service agreement with invalid end timestamp.`);
        for (const result of results) {
            try {
                ual = result.s;
                const keyword = result.o.split('"').join('');
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

                await this.tripleStoreModuleManager.update(updateQuery);
                this.logger.trace(`Updated service agreement ${agreementId} end timestamp.`);
            } catch (error) {
                this.logger.warn(
                    `Error while trying to update end timestamp for agreement id: ${agreementId}, ual: ${ual}. Error: ${error.message}`,
                );
            }
        }
    }
}

export default UpdateServiceAgreementEndTimeMigration;
