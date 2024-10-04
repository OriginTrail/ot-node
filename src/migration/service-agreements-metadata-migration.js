/* eslint-disable no-await-in-loop */
import path from 'path';
import { setTimeout } from 'timers/promises';
import BaseMigration from './base-migration.js';
import {
    CONTENT_ASSET_HASH_FUNCTION_ID,
    SCHEMA_CONTEXT,
    TRIPLE_STORE,
    SERVICE_AGREEMENT_SOURCES,
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
        if (await this.fileService.pathExists(migrationInfoPath)) {
            migrationInfo = await this.fileService
                .readFile(migrationInfoPath, true)
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
            TRIPLE_STORE.REPOSITORIES.PUBLIC_CURRENT,
            query,
        );
        const identities = {};
        const concurrency = 3;
        let promises = [];
        let assetsToProcess = assetsMetadata.length;
        for (const { ual } of assetsMetadata) {
            const { blockchain, contract, tokenId } = this.ualService.resolveUAL(ual);
            if (!identities[blockchain]) {
                identities[blockchain] = await this.blockchainModuleManager.getIdentityId(
                    blockchain,
                );
            }
            promises.push(
                this.processAsset(ual, blockchain, contract, tokenId, identities[blockchain]),
            );
            assetsToProcess -= 1;
            if (promises.length >= concurrency) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.all(promises);
                promises = [];
                await this.fileService.writeContentsToFile(
                    migrationFolderPath,
                    migrationInfoFileName,
                    JSON.stringify({ lastProcessedTokenId: tokenId }),
                    false,
                );
                this.logger.trace(
                    `${this.migrationName} remaining assets to process: ${assetsToProcess}.`,
                );
            }
        }
        await Promise.all(promises);
    }

    async processAsset(ual, blockchain, contract, tokenId, identityId) {
        const maxAttempts = 10;
        const sleepTimeSeconds = 2;

        // get assertion ids
        let attempt = 0;
        let assertionIds;
        while (!assertionIds) {
            attempt += 1;
            if (attempt >= maxAttempts)
                throw Error(
                    `Error while trying to get assertion ids for asset with ual: ${ual}. Max attempts reached`,
                );
            if (attempt > 1) {
                await setTimeout(sleepTimeSeconds * 1000);
            }
            try {
                assertionIds = await this.blockchainModuleManager.getAssertionIds(
                    blockchain,
                    contract,
                    tokenId,
                );
            } catch (error) {
                this.logger.warn(
                    `Error while trying to get assertion ids for asset with ual: ${ual}. Retrying in ${sleepTimeSeconds} seconds. Attempt number: ${attempt}.`,
                );
            }
        }

        if (!assertionIds?.length) {
            this.logger.warn(`Unable to find assertion ids for asset with ual: ${ual}`);
            return;
        }
        const stateIndex = assertionIds.length - 1;
        const assertionId = assertionIds[stateIndex];
        // calculate keyword
        const keyword = this.blockchainModuleManager.encodePacked(
            blockchain,
            ['address', 'bytes32'],
            [contract, assertionIds[0]],
        );

        // generate agreement id
        const agreementId = this.serviceAgreementService.generateId(
            blockchain,
            contract,
            tokenId,
            keyword,
            CONTENT_ASSET_HASH_FUNCTION_ID,
        );

        // get agreement data
        attempt = 0;
        let agreementData;
        while (!agreementData) {
            attempt += 1;
            if (attempt >= maxAttempts)
                throw Error(
                    `Error while trying to get agreement data for asset with ual: ${ual}. Max attempts reached`,
                );
            if (attempt > 1) {
                await setTimeout(sleepTimeSeconds * 1000);
            }
            try {
                agreementData = await this.blockchainModuleManager.getAgreementData(
                    blockchain,
                    agreementId,
                );
            } catch (error) {
                this.logger.warn(
                    `Error while trying to get agreement data for asset with ual: ${ual}. Retrying in ${sleepTimeSeconds} seconds. Attempt number: ${attempt}.`,
                );
            }
        }

        // calculate current epoch
        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        const epoch = Math.floor((now - agreementData.startTime) / agreementData.epochLength);

        // service agreement expired, don't update commits and proofs
        if (epoch >= Number(agreementData.epochsNumber)) return;

        // get top commits
        attempt = 0;
        let commits;
        while (!commits) {
            attempt += 1;
            if (attempt >= maxAttempts)
                throw Error(
                    `Error while trying to get top commit submissions for asset with ual: ${ual}. Max attempts reached`,
                );
            if (attempt > 1) {
                await setTimeout(sleepTimeSeconds * 1000);
            }
            try {
                commits = await this.blockchainModuleManager.getTopCommitSubmissions(
                    blockchain,
                    agreementId,
                    epoch,
                    stateIndex,
                );
            } catch (error) {
                this.logger.warn(
                    `Error while trying to get top commit submissions for asset with ual: ${ual}. Retrying in ${sleepTimeSeconds} seconds. Attempt number: ${attempt}.`,
                );
            }
        }

        let lastCommitEpoch = null;
        let lastProofEpoch = null;

        for (const commit of commits) {
            if (Number(commit.identityId) === identityId) {
                lastCommitEpoch = epoch;
                if (Number(commit.score) === 0) {
                    lastProofEpoch = epoch;
                }
            }
        }

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
            CONTENT_ASSET_HASH_FUNCTION_ID,
            keyword,
            assertionId,
            stateIndex,
            SERVICE_AGREEMENT_SOURCES.BLOCKCHAIN,
            lastCommitEpoch,
            lastProofEpoch,
        );
    }
}

export default ServiceAgreementsMetadataMigration;
