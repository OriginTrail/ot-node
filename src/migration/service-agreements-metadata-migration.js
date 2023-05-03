/* eslint-disable no-await-in-loop */
import path from 'path';
import BaseMigration from './base-migration.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    SCHEMA_CONTEXT,
    TRIPLE_STORE_REPOSITORIES,
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
        const migrationFolderPath = this.fileService.getMigrationFolderPath();
        const migrationInfoFileName = `${this.migrationName}_info`;
        const migrationInfoPath = path.join(migrationFolderPath, migrationInfoFileName);
        let migrationInfo;
        if (await this.fileService.fileExists(migrationInfoPath)) {
            migrationInfo = await this.fileService
                ._readFile(migrationInfoPath, true)
                .catch(() => {});
        }
        if (!migrationInfo?.lastProcessedTokenId) {
            migrationInfo = {
                lastProcessedTokenId: -1,
            };
        }
        // get metadata of all stored assets in public current triple store
        const query = `PREFIX schema: <${SCHEMA_CONTEXT}>
                        SELECT DISTINCT ?ual  WHERE {
                            GRAPH <assets:graph> {
                                ?ual schema:tokenId ?tokenId
                            }
                            FILTER (xsd:integer(?tokenId) > ${migrationInfo.lastProcessedTokenId})
                        }
                        ORDER BY ASC(xsd:integer(?tokenId))`;
        const assetsMetadata = await this.tripleStoreService.select(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
            query,
        );
        const identities = {};
        // for each asset
        for (const { ual } of assetsMetadata) {
            const { blockchain, contract, tokenId } = this.ualService.resolveUAL(ual);
            if (!identities[blockchain]) {
                identities[blockchain] = await this.blockchainModuleManager.getIdentityId(
                    blockchain,
                );
            }
            await this.updateTables(ual, blockchain, contract, tokenId, identities[blockchain]);

            this.logger.trace(`${this.migrationName} processed asset with ual: ${ual}`);
            await this.fileService.writeContentsToFile(
                migrationFolderPath,
                migrationInfoFileName,
                JSON.stringify({ lastProcessedTokenId: tokenId }),
            );
        }
    }

    async updateTables(ual, blockchain, contract, tokenId, identityId) {
        // get assertion ids
        const assertionIds = await this.blockchainModuleManager
            .getAssertionIds(blockchain, contract, tokenId)
            .catch(() => {});

        if (!assertionIds?.length) {
            this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
            return;
        }
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

        // store in service_agreement table
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
        }

        if (proofSubmitted) {
            // store in attempted-proof-command table
        }
    }
}

export default ServiceAgreementsMetadataMigration;
