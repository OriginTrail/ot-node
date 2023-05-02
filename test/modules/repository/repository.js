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
        logger.info = () => {};
    });

    beforeEach('Initialize repository module manager', async () => {
        repositoryModuleManager = new RepositoryModuleManager({ config, logger });
        await repositoryModuleManager.initialize();
    });

    afterEach('Destroy all records', async () => {
        await repositoryModuleManager.destroyAllRecords('service_agreement');
    });

    after(async () => {
        await repositoryModuleManager.dropDatabase();
    });

    describe('Empty repository', () => {
        it('returns empty list if no service agreements', async () => {
            const eligibleAgreements =
                await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(Date.now(), 25);

            assert(expect(eligibleAgreements).to.exist);
            expect(eligibleAgreements).to.be.instanceOf(Array);
            expect(eligibleAgreements).to.have.length(0);
        });
    });
    describe('Insert and update service agreement', () => {
        const agreement = {
            blockchain_id: 'hardhat',
            asset_storage_contract_address: '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
            token_id: 0,
            agreement_id: '0x44cf660357e2d7462c25fd8e50b68abe332d7a70b07a76e92f628846ea585881',
            start_time: 1683032289,
            epochs_number: 2,
            epoch_length: 360,
            score_function_id: 1,
            proof_window_offset_perc: 66,
        };

        it('inserts service agreement', async () => {
            const inserted = await repositoryModuleManager.updateServiceAgreementRecord(
                agreement.blockchain_id,
                agreement.asset_storage_contract_address,
                agreement.token_id,
                agreement.agreement_id,
                agreement.start_time,
                agreement.epochs_number,
                agreement.epoch_length,
                agreement.score_function_id,
                agreement.proof_window_offset_perc,
            );
            const row = inserted[0]?.dataValues;

            assert(expect(row).to.exist);
            expect(row.blockchain_id).to.equal(agreement.blockchain_id);
            expect(row.asset_storage_contract_address).to.equal(
                agreement.asset_storage_contract_address,
            );
            expect(row.token_id).to.equal(agreement.token_id);
            expect(row.agreement_id).to.equal(agreement.agreement_id);
            expect(row.start_time).to.equal(agreement.start_time);
            expect(row.epochs_number).to.equal(agreement.epochs_number);
            expect(row.epoch_length).to.equal(agreement.epoch_length);
            expect(row.score_function_id).to.equal(agreement.score_function_id);
            expect(row.proof_window_offset_perc).to.equal(agreement.proof_window_offset_perc);
            assert(expect(row.last_commit_epoch).to.not.exist);
            assert(expect(row.last_proof_epoch).to.not.exist);
        });
    });

    describe('Eligible service agreements', () => {
        const agreements = [
            {
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
            },
            {
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
            },
            {
                blockchain_id: 'hardhat',
                asset_storage_contract_address: '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
                token_id: 3,
                agreement_id: '0x44cf660357e2d7462c25fd8e50b68abe332d7a70b07a76e92f628846ea585881',
                start_time: 25,
                epochs_number: 2,
                epoch_length: 100,
                score_function_id: 1,
                proof_window_offset_perc: 66,
                last_commit_epoch: 0,
                last_proof_epoch: null,
            },
            {
                blockchain_id: 'hardhat',
                asset_storage_contract_address: '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
                token_id: 4,
                agreement_id: '0x44cf660357e2d7462c25fd8e50b68abe332d7a70b07a76e92f628846ea585881',
                start_time: 49,
                epochs_number: 2,
                epoch_length: 100,
                score_function_id: 1,
                proof_window_offset_perc: 66,
                last_commit_epoch: null,
                last_proof_epoch: null,
            },
        ];

        beforeEach(async () => {
            await Promise.all(
                agreements.map((agreement) =>
                    repositoryModuleManager.updateServiceAgreementRecord(
                        agreement.blockchain_id,
                        agreement.asset_storage_contract_address,
                        agreement.token_id,
                        agreement.agreement_id,
                        agreement.start_time,
                        agreement.epochs_number,
                        agreement.epoch_length,
                        agreement.score_function_id,
                        agreement.proof_window_offset_perc,
                        agreement.last_commit_epoch,
                    ),
                ),
            );
        });
        function testEligibleAgreements(
            currentTimestamp,
            commitWindowDurationPerc,
            expectedAgreements,
        ) {
            return async () => {
                const eligibleAgreements =
                    await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
                        currentTimestamp,
                        commitWindowDurationPerc,
                    );

                assert(expect(eligibleAgreements).to.exist);
                expect(eligibleAgreements).to.be.instanceOf(Array);
                expect(eligibleAgreements).to.have.length(expectedAgreements.length);
                expect(eligibleAgreements).to.deep.equal(expectedAgreements);
            };
        }
        it(
            'returns two eligible service agreements at timestamp 49',
            testEligibleAgreements(49 * 1000, 25, [agreements[1], agreements[3]]),
        );
        it(
            'returns one eligible service agreement at timestamp 51',
            testEligibleAgreements(51 * 1000, 25, [agreements[3]]),
        );
        it(
            'returns one eligible service agreement at timestamp 74',
            testEligibleAgreements(74 * 1000, 25, [agreements[3]]),
        );
        it(
            'returns no eligible service agreements at timestamp 75',
            testEligibleAgreements(75 * 1000, 25, []),
        );
        it(
            'returns one eligible service agreements at timestamp 100',
            testEligibleAgreements(100 * 1000, 25, [agreements[0]]),
        );
        it(
            'returns three eligible service agreements at timestamp 125',
            testEligibleAgreements(125 * 1000, 25, [agreements[0], agreements[1], agreements[2]]),
        );
        it(
            'returns two eligible service agreements at timestamp 126',
            testEligibleAgreements(126 * 1000, 25, [agreements[1], agreements[2]]),
        );
        it(
            'returns three eligible service agreements at timestamp 149',
            testEligibleAgreements(149 * 1000, 25, [agreements[1], agreements[2], agreements[3]]),
        );
        it(
            'returns one eligible service agreements at timestamp 151',
            testEligibleAgreements(151 * 1000, 25, [agreements[3]]),
        );
        it(
            'returns no eligible service agreements at timestamp 175',
            testEligibleAgreements(175 * 1000, 25, []),
        );
        it(
            'returns no eligible service agreements at timestamp 225',
            testEligibleAgreements(225 * 1000, 25, []),
        );
    });
});
