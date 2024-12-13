import { utils } from 'ethers';
import { describe, it, before, beforeEach, afterEach, after } from 'mocha';
import { expect, assert } from 'chai';
import { readFile } from 'fs/promises';
import Logger from '../../../../src/logger/logger.js';
import RepositoryModuleManager from '../../../../src/modules/repository/repository-module-manager.js';

let logger;
let repositoryModuleManager;
const config = JSON.parse(await readFile('./test/unit/modules/repository/config.json'));

const blockchain = 'hardhat';
const createAgreement = ({
    blockchainId = blockchain,
    assetStorageContractAddress = '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
    tokenId,
    id = null,
    startTime,
    epochsNumber = 2,
    epochLength = 100,
    scoreFunctionId = 1,
    proofWindowOffsetPerc = 66,
    hashFunctionId = 1,
    keyword = '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca0768e44dc71bf509adfccbea9df949f253afa56796a3a926203f90a1e4914247d3',
    assertionMerkleRoot = '0x68e44dc71bf509adfccbea9df949f253afa56796a3a926203f90a1e4914247d3',
    stateIndex = 1,
    lastCommitEpoch = null,
    lastProofEpoch = null,
}) => {
    const agreementId =
        id ??
        utils.sha256(
            utils.toUtf8Bytes(
                utils.solidityPack(
                    ['address', 'uint256', 'bytes'],
                    [assetStorageContractAddress, tokenId, keyword],
                ),
            ),
        );
    return {
        blockchainId,
        assetStorageContractAddress,
        tokenId,
        agreementId,
        startTime,
        epochsNumber,
        epochLength,
        scoreFunctionId,
        proofWindowOffsetPerc,
        hashFunctionId,
        keyword,
        assertionMerkleRoot,
        stateIndex,
        lastCommitEpoch,
        lastProofEpoch,
    };
};

describe('Repository module', () => {
    before('Initialize repository module manager', async function initializeRepository() {
        this.timeout(30_000);
        logger = new Logger('trace');
        logger.info = () => {};
        repositoryModuleManager = new RepositoryModuleManager({ config, logger });
        await repositoryModuleManager.initialize();
        await repositoryModuleManager.destroyAllRecords('service_agreement');
    });

    afterEach('Destroy all records', async function destroyAllRecords() {
        this.timeout(30_000);
        await repositoryModuleManager.destroyAllRecords('service_agreement');
    });

    after(async function dropDatabase() {
        this.timeout(30_000);
        await repositoryModuleManager.dropDatabase();
    });

    describe('Empty repository', () => {
        it('returns empty list if no service agreements', async () => {
            const eligibleAgreements =
                await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
                    Date.now(),
                    blockchain,
                    25,
                );

            assert(expect(eligibleAgreements).to.exist);
            expect(eligibleAgreements).to.be.instanceOf(Array);
            expect(eligibleAgreements).to.have.length(0);
        });
    });
    describe('Insert and update service agreement', () => {
        const agreement = {
            blockchainId: blockchain,
            assetStorageContractAddress: '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07',
            tokenId: 0,
            agreementId: '0x44cf660357e2d7462c25fd8e50b68abe332d7a70b07a76e92f628846ea585881',
            startTime: 1683032289,
            epochsNumber: 2,
            epochLength: 360,
            scoreFunctionId: 1,
            proofWindowOffsetPerc: 66,
            hashFunctionId: 1,
            keyword:
                '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca0768e44dc71bf509adfccbea9df949f253afa56796a3a926203f90a1e4914247d3',
            assertionMerkleRoot:
                '0x68e44dc71bf509adfccbea9df949f253afa56796a3a926203f90a1e4914247d3',
            stateIndex: 1,
        };

        it('inserts service agreement', async () => {
            const inserted = await repositoryModuleManager.updateServiceAgreementRecord(
                agreement.blockchainId,
                agreement.assetStorageContractAddress,
                agreement.tokenId,
                agreement.agreementId,
                agreement.startTime,
                agreement.epochsNumber,
                agreement.epochLength,
                agreement.scoreFunctionId,
                agreement.proofWindowOffsetPerc,
                agreement.hashFunctionId,
                agreement.keyword,
                agreement.assertionMerkleRoot,
                agreement.stateIndex,
                agreement.lastCommitEpoch,
                agreement.lastProofEpoch,
            );
            const row = inserted[0]?.dataValues;

            assert(expect(row).to.exist);
            expect(row.blockchainId).to.equal(agreement.blockchainId);
            expect(row.assetStorageContractAddress).to.equal(agreement.assetStorageContractAddress);
            expect(row.tokenId).to.equal(agreement.tokenId);
            expect(row.agreementId).to.equal(agreement.agreementId);
            expect(row.startTime).to.equal(agreement.startTime);
            expect(row.epochsNumber).to.equal(agreement.epochsNumber);
            expect(row.epochLength).to.equal(agreement.epochLength);
            expect(row.scoreFunctionId).to.equal(agreement.scoreFunctionId);
            expect(row.proofWindowOffsetPerc).to.equal(agreement.proofWindowOffsetPerc);
            expect(row.hashFunctionId).to.equal(agreement.hashFunctionId);
            expect(row.keyword).to.equal(agreement.keyword);
            expect(row.assertionMerkleRoot).to.equal(agreement.assertionMerkleRoot);
            expect(row.stateIndex).to.equal(agreement.stateIndex);
            assert(expect(row.lastCommitEpoch).to.not.exist);
            assert(expect(row.lastProofEpoch).to.not.exist);
        });
    });

    describe('Eligible service agreements', () => {
        const agreements = [
            createAgreement({ tokenId: 0, startTime: 0 }),
            createAgreement({
                tokenId: 1,
                startTime: 15,
                lastCommitEpoch: 0,
            }),
            createAgreement({ tokenId: 2, startTime: 25 }),
            createAgreement({
                tokenId: 3,
                startTime: 25,
                lastCommitEpoch: 0,
                lastProofEpoch: 0,
            }),
            createAgreement({ tokenId: 4, startTime: 49 }),
        ];

        beforeEach(async () => {
            await Promise.all(
                agreements.map((agreement) =>
                    repositoryModuleManager.updateServiceAgreementRecord(
                        agreement.blockchainId,
                        agreement.assetStorageContractAddress,
                        agreement.tokenId,
                        agreement.agreementId,
                        agreement.startTime,
                        agreement.epochsNumber,
                        agreement.epochLength,
                        agreement.scoreFunctionId,
                        agreement.proofWindowOffsetPerc,
                        agreement.hashFunctionId,
                        agreement.keyword,
                        agreement.assertionMerkleRoot,
                        agreement.stateIndex,
                        agreement.lastCommitEpoch,
                        agreement.lastProofEpoch,
                    ),
                ),
            );
        });

        describe('getEligibleAgreementsForSubmitCommit returns correct agreements', () => {
            const testEligibleAgreementsForSubmitCommit =
                (currentTimestamp, commitWindowDurationPerc, expectedAgreements) => async () => {
                    const eligibleAgreements =
                        await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
                            currentTimestamp,
                            blockchain,
                            commitWindowDurationPerc,
                        );

                    assert(expect(eligibleAgreements).to.exist);
                    expect(eligibleAgreements).to.be.instanceOf(Array);
                    expect(eligibleAgreements).to.have.length(expectedAgreements.length);
                    expect(eligibleAgreements).to.have.deep.members(expectedAgreements);

                    // ensure order is correct
                    for (let i = 0; i < eligibleAgreements.length; i += 1) {
                        assert.strictEqual(
                            eligibleAgreements[i].timeLeftInSubmitCommitWindow,
                            expectedAgreements[i].timeLeftInSubmitCommitWindow,
                        );
                    }
                };

            it(
                'returns two eligible service agreements at timestamp 49',
                testEligibleAgreementsForSubmitCommit(49, 25, [
                    { ...agreements[2], currentEpoch: 0, timeLeftInSubmitCommitWindow: 1 },
                    { ...agreements[4], currentEpoch: 0, timeLeftInSubmitCommitWindow: 25 },
                ]),
            );
            it(
                'returns one eligible service agreement at timestamp 51',
                testEligibleAgreementsForSubmitCommit(51, 25, [
                    { ...agreements[4], currentEpoch: 0, timeLeftInSubmitCommitWindow: 23 },
                ]),
            );
            it(
                'returns no eligible service agreement at timestamp 74',
                testEligibleAgreementsForSubmitCommit(74, 25, []),
            );
            it(
                'returns no eligible service agreements at timestamp 75',
                testEligibleAgreementsForSubmitCommit(75, 25, []),
            );
            it(
                'returns one eligible service agreements at timestamp 100',
                testEligibleAgreementsForSubmitCommit(100, 25, [
                    { ...agreements[0], currentEpoch: 1, timeLeftInSubmitCommitWindow: 25 },
                ]),
            );
            it(
                'returns two eligible service agreements at timestamp 124',
                testEligibleAgreementsForSubmitCommit(124, 25, [
                    { ...agreements[0], currentEpoch: 1, timeLeftInSubmitCommitWindow: 1 },
                    { ...agreements[1], currentEpoch: 1, timeLeftInSubmitCommitWindow: 16 },
                ]),
            );
            it(
                'returns three eligible service agreements at timestamp 125',
                testEligibleAgreementsForSubmitCommit(125, 25, [
                    { ...agreements[1], currentEpoch: 1, timeLeftInSubmitCommitWindow: 15 },
                    { ...agreements[2], currentEpoch: 1, timeLeftInSubmitCommitWindow: 25 },
                    { ...agreements[3], currentEpoch: 1, timeLeftInSubmitCommitWindow: 25 },
                ]),
            );
            it(
                'returns three eligible service agreements at timestamp 126',
                testEligibleAgreementsForSubmitCommit(126, 25, [
                    { ...agreements[1], currentEpoch: 1, timeLeftInSubmitCommitWindow: 14 },
                    { ...agreements[2], currentEpoch: 1, timeLeftInSubmitCommitWindow: 24 },
                    { ...agreements[3], currentEpoch: 1, timeLeftInSubmitCommitWindow: 24 },
                ]),
            );
            it(
                'returns three eligible service agreements at timestamp 149',
                testEligibleAgreementsForSubmitCommit(149, 25, [
                    { ...agreements[2], currentEpoch: 1, timeLeftInSubmitCommitWindow: 1 },
                    { ...agreements[3], currentEpoch: 1, timeLeftInSubmitCommitWindow: 1 },
                    { ...agreements[4], currentEpoch: 1, timeLeftInSubmitCommitWindow: 25 },
                ]),
            );
            it(
                'returns one eligible service agreements at timestamp 151',
                testEligibleAgreementsForSubmitCommit(151, 25, [
                    { ...agreements[4], currentEpoch: 1, timeLeftInSubmitCommitWindow: 23 },
                ]),
            );
            it(
                'returns no eligible service agreements at timestamp 175',
                testEligibleAgreementsForSubmitCommit(175, 25, []),
            );
            it(
                'returns no eligible service agreements at timestamp 225',
                testEligibleAgreementsForSubmitCommit(225, 25, []),
            );
        });

        describe('getEligibleAgreementsForSubmitProof returns correct agreements', () => {
            const testEligibleAgreementsForSubmitProof =
                (currentTimestamp, proofWindowDurationPerc, expectedAgreements) => async () => {
                    const eligibleAgreements =
                        await repositoryModuleManager.getEligibleAgreementsForSubmitProof(
                            currentTimestamp,
                            blockchain,
                            proofWindowDurationPerc,
                        );

                    assert(expect(eligibleAgreements).to.exist);
                    expect(eligibleAgreements).to.be.instanceOf(Array);
                    expect(eligibleAgreements).to.have.length(expectedAgreements.length);
                    expect(eligibleAgreements).to.have.deep.members(expectedAgreements);

                    // ensure order is correct
                    for (let i = 0; i < eligibleAgreements.length; i += 1) {
                        assert.strictEqual(
                            eligibleAgreements[i].timeLeftInSubmitProofWindow,
                            expectedAgreements[i].timeLeftInSubmitProofWindow,
                        );
                    }
                };

            it(
                'returns no eligible service agreement at timestamp 49',
                testEligibleAgreementsForSubmitProof(49, 33, []),
            );
            it(
                'returns no eligible service agreement at timestamp 67',
                testEligibleAgreementsForSubmitProof(67, 33, []),
            );
            it(
                'returns no eligible service agreement at timestamp 80',
                testEligibleAgreementsForSubmitProof(80, 33, []),
            );
            it(
                'returns one eligible service agreements at timestamp 81',
                testEligibleAgreementsForSubmitProof(81, 33, [
                    { ...agreements[1], currentEpoch: 0, timeLeftInSubmitProofWindow: 33 },
                ]),
            );
            it(
                'returns one eligible service agreements at timestamp 92',
                testEligibleAgreementsForSubmitProof(92, 33, [
                    { ...agreements[1], currentEpoch: 0, timeLeftInSubmitProofWindow: 22 },
                ]),
            );
            it(
                'returns one eligible service agreements at timestamp 113',
                testEligibleAgreementsForSubmitProof(113, 33, [
                    { ...agreements[1], currentEpoch: 0, timeLeftInSubmitProofWindow: 1 },
                ]),
            );
            it(
                'returns no eligible service agreements at timestamp 114',
                testEligibleAgreementsForSubmitProof(114, 33, []),
            );
            it(
                'returns no eligible service agreements at timestamp 167',
                testEligibleAgreementsForSubmitProof(167, 33, []),
            );
            it(
                'returns no eligible service agreements at timestamp 181',
                testEligibleAgreementsForSubmitProof(181, 33, []),
            );
            it(
                'returns no eligible service agreements at timestamp 192',
                testEligibleAgreementsForSubmitProof(192, 33, []),
            );
            it(
                'returns no eligible service agreements at timestamp 199',
                testEligibleAgreementsForSubmitProof(199, 33, []),
            );
            it(
                'returns no eligible service agreements at timestamp 200',
                testEligibleAgreementsForSubmitProof(200, 33, []),
            );
        });
    });

    async function insertLoadTestAgreements(numAgreements) {
        let agreements = [];
        for (let tokenId = 0; tokenId < numAgreements; tokenId += 1) {
            agreements.push(
                createAgreement({
                    tokenId,
                    startTime: Math.floor(Math.random() * 101),
                    lastCommitEpoch: [null, 0][Math.floor(Math.random() * 3)],
                    lastProofEpoch: [null, 0][Math.floor(Math.random() * 3)],
                }),
            );

            if (agreements.length % 100_000 === 0) {
                // eslint-disable-next-line no-await-in-loop
                await repositoryModuleManager.bulkCreateServiceAgreementRecords(agreements);
                agreements = [];
            }
        }
        if (agreements.length) {
            await repositoryModuleManager.bulkCreateServiceAgreementRecords(agreements);
        }
    }

    describe.skip('test load', () => {
        describe('100_000 rows', () => {
            beforeEach(async function t() {
                this.timeout(0);
                await insertLoadTestAgreements(100_000);
            });

            it('getEligibleAgreementsForSubmitCommit returns agreements in less than 100 ms', async () => {
                const start = performance.now();
                await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
                    100,
                    blockchain,
                    25,
                );
                const end = performance.now();
                const duration = end - start;
                expect(duration).to.be.lessThan(100);
            });

            it('getEligibleAgreementsForSubmitProof returns agreements in less than 100 ms', async () => {
                const start = performance.now();
                await repositoryModuleManager.getEligibleAgreementsForSubmitProof(
                    100,
                    blockchain,
                    33,
                );
                const end = performance.now();
                const duration = end - start;
                expect(duration).to.be.lessThan(100);
            });
        });

        describe('1_000_000 rows', () => {
            beforeEach(async function t() {
                this.timeout(0);
                await insertLoadTestAgreements(1_000_000);
            });

            it('getEligibleAgreementsForSubmitCommit returns agreements in less than 1000 ms', async () => {
                const start = performance.now();
                await repositoryModuleManager.getEligibleAgreementsForSubmitCommit(
                    100,
                    blockchain,
                    25,
                );
                const end = performance.now();
                const duration = end - start;
                expect(duration).to.be.lessThan(1000);
            });

            it('getEligibleAgreementsForSubmitProof returns agreements in less than 1000 ms', async () => {
                const start = performance.now();
                await repositoryModuleManager.getEligibleAgreementsForSubmitProof(
                    100,
                    blockchain,
                    33,
                );
                const end = performance.now();
                const duration = end - start;
                expect(duration).to.be.lessThan(1000);
            });
        });
    });
});
