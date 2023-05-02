import { describe, it, before, beforeEach, afterEach, after } from 'mocha';
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
    afterEach('Destroy all records', async () => {
        await repositoryModuleManager.destroyAllRecords('service_agreement');
    });
    after(async () => {
        await repositoryModuleManager.dropDatabase();
    });
    it('returns empty list if no service agreements', async () => {
        const eligibleAgreements =
            await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(Date.now(), 25);

        assert(expect(eligibleAgreements).to.exist);
        expect(eligibleAgreements).to.be.instanceOf(Array);
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

        assert(expect(row).to.exist);
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
        assert(expect(row.last_commit_epoch).to.not.exist);
        assert(expect(row.last_proof_epoch).to.not.exist);
    });

    it('returns correct eligible service agreements on first epoch', async () => {
        const serviceAgreement1 = {
            blockchain_id: 'hardhat',
            asset_storage_contract_address: '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
            token_id: 0,
            agreement_id: '0x44cf660357e2d7462c25fd8e50b68abe332d7a70b07a76e92f628846ea585881',
            start_time: 0,
            epochs_number: 2,
            epoch_length: 100,
            score_function_id: 1,
            proof_window_offset_perc: 66,
            last_commit_epoch: null,
            last_proof_epoch: null,
        };
        const serviceAgreement2 = {
            blockchain_id: 'hardhat',
            asset_storage_contract_address: '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
            token_id: 1,
            agreement_id: '0x44cf660357e2d7462c25fd8e50b68abe332d7a70b07a76e92f628846ea585881',
            start_time: 25,
            epochs_number: 2,
            epoch_length: 100,
            score_function_id: 1,
            proof_window_offset_perc: 66,
            last_commit_epoch: null,
            last_proof_epoch: null,
        };
        const serviceAgreement3 = {
            blockchain_id: 'hardhat',
            asset_storage_contract_address: '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
            token_id: 2,
            agreement_id: '0x44cf660357e2d7462c25fd8e50b68abe332d7a70b07a76e92f628846ea585881',
            start_time: 49,
            epochs_number: 2,
            epoch_length: 100,
            score_function_id: 1,
            proof_window_offset_perc: 66,
            last_commit_epoch: null,
            last_proof_epoch: null,
        };

        await Promise.all(
            [serviceAgreement1, serviceAgreement2, serviceAgreement3].map(
                ({
                    blockchain_id,
                    asset_storage_contract_address,
                    token_id,
                    agreement_id,
                    start_time,
                    epochs_number,
                    epoch_length,
                    score_function_id,
                    proof_window_offset_perc,
                }) =>
                    repositoryModuleManager.updateServiceAgreementRecord(
                        blockchain_id,
                        asset_storage_contract_address,
                        token_id,
                        agreement_id,
                        start_time,
                        epochs_number,
                        epoch_length,
                        score_function_id,
                        proof_window_offset_perc,
                    ),
            ),
        );

        const commitWindowDurationPerc = 25;
        let currentTimestamp = 49 * 1000;
        let eligibleAgreements = await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
            currentTimestamp,
            commitWindowDurationPerc,
        );
        assert(expect(eligibleAgreements).to.exist);
        expect(eligibleAgreements).to.be.instanceOf(Array);
        expect(eligibleAgreements).to.have.length(2);
        expect(eligibleAgreements).to.deep.equal([serviceAgreement2, serviceAgreement3]);

        currentTimestamp = 51 * 1000;
        eligibleAgreements = await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
            currentTimestamp,
            commitWindowDurationPerc,
        );
        assert(expect(eligibleAgreements).to.exist);
        expect(eligibleAgreements).to.be.instanceOf(Array);
        expect(eligibleAgreements).to.have.length(1);
        expect(eligibleAgreements).to.deep.equal([serviceAgreement3]);

        currentTimestamp = 74 * 1000;
        eligibleAgreements = await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
            currentTimestamp,
            commitWindowDurationPerc,
        );
        assert(expect(eligibleAgreements).to.exist);
        expect(eligibleAgreements).to.be.instanceOf(Array);
        expect(eligibleAgreements).to.have.length(1);
        expect(eligibleAgreements).to.deep.equal([serviceAgreement3]);

        currentTimestamp = 75 * 1000;
        eligibleAgreements = await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
            currentTimestamp,
            commitWindowDurationPerc,
        );
        assert(expect(eligibleAgreements).to.exist);
        expect(eligibleAgreements).to.be.instanceOf(Array);
        expect(eligibleAgreements).to.have.length(0);
    });
});
