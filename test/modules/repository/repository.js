import { describe, it, before, beforeEach } from 'mocha';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';
import Logger from '../../../src/logger/logger.js';
import RepositoryModuleManager from '../../../src/modules/repository/repository-module-manager.js';

let logger;
let repositoryModuleManager;
const config = JSON.parse(await readFile('./test/modules/repository/config.json'));

describe('Repository module', () => {
    before('Initialize logger', () => {
        logger = new Logger('trace');
    });
    beforeEach('Initialize repository module manager', async () => {
        repositoryModuleManager = new RepositoryModuleManager({
            config,
            logger,
        });
        await repositoryModuleManager.initialize();
    });
    it('returns empty list if no service agreements', async () => {
        const eligibleAgreements =
            await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(Date.now(), 0.25);

        expect(eligibleAgreements).to.have.length(0);
    });
    it('inserts service agreement', async () => {
        const blockchain = 'hardhat';
        const contract = '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07';
        const tokenId = 0;
        const agreementId = '0x44cf660357e2d7462c25fd8e50b68abe332d7a70b07a76e92f628846ea585881';
        const agreementStartTime = 1683032289;
        const epochsNumber = 2;
        const epochLength = 360;
        const scoreFunctionId = 1;
        const proofWindowOffsetPerc = 66;

        const inserted = await repositoryModuleManager.updateServiceAgreementRecord(
            blockchain,
            contract,
            tokenId,
            agreementId,
            agreementStartTime,
            epochsNumber,
            epochLength,
            scoreFunctionId,
            proofWindowOffsetPerc,
        );
        const row = inserted[0]?.dataValues;

        assert(expect(row).to.not.be.null);
        expect(row.blockchain_id).to.equal(blockchain);
        expect(row.asset_storage_contract_address).to.equal(contract);
        expect(row.token_id).to.equal(tokenId);
        expect(row.agreement_id).to.equal(agreementId);
        expect(row.start_time).to.equal(agreementStartTime);
        expect(row.epochs_number).to.equal(epochsNumber);
        expect(row.epoch_length).to.equal(epochLength);
        expect(row.score_function_id).to.equal(scoreFunctionId);
        expect(row.score_function_id).to.equal(scoreFunctionId);
        expect(row.proof_window_offset_perc).to.equal(proofWindowOffsetPerc);
        expect(row.last_commit_epoch).to.equal(0);
        expect(row.last_proof_epoch).to.equal(0);
    });
});
