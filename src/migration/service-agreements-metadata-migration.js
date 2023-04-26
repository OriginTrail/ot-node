import BaseMigration from './base-migration.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    SCHEMA_CONTEXT,
    TRIPLE_STORE_REPOSITORIES,
    ATTEMPTED_COMMIT_COMMAND_STATUS,
    ATTEMPTED_PROOF_COMMAND_STATUS,
} from '../constants/constants.js';

class ServiceAgreementsMetadataMigration extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        tripleStoreService,
        blockchainModuleManager,
        repositoryModuleManager,
        serviceAgreementService,
        ualService,
    ) {
        super(migrationName, logger, config);
        this.blockchainModuleManager = blockchainModuleManager;
        this.repositoryModuleManager = repositoryModuleManager;
        this.serviceAgreementService = serviceAgreementService;
        this.ualService = ualService;
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        // get metadata of all stored assets in public current triple store
        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                        SELECT DISTINCT ?ual  WHERE {
                            GRAPH <assets:graph> {
                                    ?ual ?p ?o
                            }
                        }`;
        const assetsMetadata = await this.tripleStoreService.select(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            query,
        );
        const identities = {};
        // for each asset
        for (const { ual } of assetsMetadata) {
            const { blockchain, contract, tokenId } = this.ualService.resolveUAL(ual);
            if (!identities[blockchain]) {
                // eslint-disable-next-line no-await-in-loop
                identities[blockchain] = await this.blockchainModuleManager.getIdentityId(
                    blockchain,
                );
            }
            // eslint-disable-next-line no-await-in-loop
            await this.updateTables(blockchain, contract, tokenId, identities[blockchain]);
        }
    }

    async updateTables(blockchain, contract, tokenId, identityId) {
        // get assertion ids
        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            blockchain,
            contract,
            tokenId,
        );
        const stateIndex = assertionIds.length - 1;

        // calculate keyword
        const keyword = this.blockchainModuleManager.encodePacked(
            blockchain,
            ['address', 'bytes32'],
            [contract, assertionIds[0]],
        );

        // generate agreement id
        const agreementId = await this.serviceAgreementService.generateId(
            blockchain,
            contract,
            tokenId,
            keyword,
            CONTENT_ASSET_HASH_FUNCTION_ID,
        );

        // get agreement data
        const agreementData = await this.blockchainModuleManager.getAgreementData(
            blockchain,
            agreementId,
        );

        // store in service_agreements table
        await this.repositoryModuleManager.updateServiceAgreementRecord(
            blockchain,
            contract,
            tokenId,
            agreementId,
            agreementData.startTime,
            agreementData.epochsNumber,
            agreementData.epochLength,
            agreementData.scoreFunctionId,
            agreementData.proofWindowOffsetPerc,
        );

        // calculate current epoch
        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        const epoch = Math.floor((now - agreementData.startTime) / agreementData.epochLength);

        // service agreement expired, don't update commits and proofs
        if (epoch >= Number(agreementData.epochsNumber)) return;

        // get top commits
        const commits = await this.blockchainModuleManager.getTopCommitSubmissions(
            blockchain,
            agreementId,
            epoch,
            stateIndex,
        );
        let commitSubmitted = false;
        let proofSubmitted = false;

        for (const commit of commits) {
            if (Number(commit.identityId) === identityId) {
                commitSubmitted = true;
                if (Number(commit.score) === 0) {
                    proofSubmitted = true;
                }
            }
        }

        if (commitSubmitted) {
            // store in attempted-commit-command table
            await this.repositoryModuleManager.updateAttemptedCommitCommandRecord(
                blockchain,
                contract,
                tokenId,
                agreementId,
                epoch,
                ATTEMPTED_COMMIT_COMMAND_STATUS.COMPLETED,
            );
        }

        if (proofSubmitted) {
            // store in attempted-proof-command table
            await this.repositoryModuleManager.updateAttemptedProofCommandRecord(
                blockchain,
                contract,
                tokenId,
                agreementId,
                epoch,
                ATTEMPTED_PROOF_COMMAND_STATUS.COMPLETED,
            );
        }
    }
}

export default ServiceAgreementsMetadataMigration;
