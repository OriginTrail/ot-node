import Sequelize from 'sequelize';

class ServiceAgreementRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.service_agreement;
    }

    async updateServiceAgreementEpochsNumber(agreementId, epochsNumber) {
        return this.model.update(
            { epochsNumber },
            {
                where: { agreementId },
            },
        );
    }

    async removeServiceAgreements(agreementIds) {
        return this.model.destroy({
            where: { agreementId: { [Sequelize.Op.in]: agreementIds } },
        });
    }

    async removeServiceAgreementsForBlockchain(blockchainId) {
        await this.model.destroy({
            where: {
                blockchainId,
            },
        });
    }

    async updateServiceAgreementRecord(
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
        assertionId,
        stateIndex,
        dataSource,
        lastCommitEpoch,
        lastProofEpoch,
    ) {
        return this.model.upsert({
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
            assertionId,
            stateIndex,
            dataSource,
            lastCommitEpoch,
            lastProofEpoch,
        });
    }

    async updateServiceAgreementForTokenId(tokenId, agreementId, keyword, assertionId, stateIndex) {
        return this.model.update(
            {
                agreementId,
                keyword,
                assertionId,
                stateIndex,
            },
            {
                where: {
                    tokenId,
                },
            },
        );
    }

    async bulkCreateServiceAgreementRecords(serviceAgreements) {
        return this.model.bulkCreate(serviceAgreements, {
            validate: true,
        });
    }

    async getServiceAgreementRecord(agreementId) {
        return this.model.findOne({
            where: {
                agreementId,
            },
        });
    }

    async updateServiceAgreementLastCommitEpoch(agreementId, lastCommitEpoch) {
        return this.model.update(
            { lastCommitEpoch },
            {
                where: {
                    agreementId,
                },
            },
        );
    }

    async updateServiceAgreementLastProofEpoch(agreementId, lastProofEpoch) {
        return this.model.update(
            { lastProofEpoch },
            {
                where: {
                    agreementId,
                },
            },
        );
    }

    async removeServiceAgreementRecord(blockchainId, contract, tokenId) {
        await this.model.destroy({
            where: {
                blockchainId,
                assetStorageContractAddress: contract,
                tokenId,
            },
        });
    }

    getEligibleAgreementsForSubmitCommit(
        timestampSeconds,
        blockchain,
        commitWindowDurationPerc,
        startTimeDelay,
    ) {
        const currentEpoch = `FLOOR((${timestampSeconds} - start_time) / epoch_length)`;
        const currentEpochPerc = `((${timestampSeconds} - start_time) % epoch_length) / epoch_length * 100`;

        return this.model.findAll({
            attributes: {
                include: [
                    [Sequelize.literal(currentEpoch), 'currentEpoch'],
                    [
                        Sequelize.cast(
                            Sequelize.literal(`${commitWindowDurationPerc} - ${currentEpochPerc}`),
                            'DOUBLE',
                        ),
                        'timeLeftInSubmitCommitWindow',
                    ],
                ],
            },
            where: {
                blockchainId: blockchain,
                [Sequelize.Op.and]: Sequelize.literal(
                    `start_time + ${startTimeDelay} < ${timestampSeconds}`,
                ),
                [Sequelize.Op.or]: [
                    {
                        lastCommitEpoch: {
                            [Sequelize.Op.is]: null,
                        },
                    },
                    {
                        lastCommitEpoch: {
                            [Sequelize.Op.lt]: Sequelize.literal(currentEpoch),
                        },
                    },
                ],
                [Sequelize.Op.and]: Sequelize.literal(
                    `${currentEpochPerc} < ${commitWindowDurationPerc}`,
                ),
                epochsNumber: {
                    [Sequelize.Op.gt]: Sequelize.literal(currentEpoch),
                },
            },
            order: [[Sequelize.col('timeLeftInSubmitCommitWindow'), 'ASC']],
            limit: 100,
            raw: true,
        });
    }

    async getEligibleAgreementsForSubmitProof(
        timestampSeconds,
        blockchain,
        proofWindowDurationPerc,
    ) {
        const currentEpoch = `FLOOR((${timestampSeconds} - start_time) / epoch_length)`;
        const currentEpochPerc = `((${timestampSeconds} - start_time) % epoch_length) / epoch_length * 100`;

        return this.model.findAll({
            attributes: {
                include: [
                    [Sequelize.literal(currentEpoch), 'currentEpoch'],
                    [
                        Sequelize.cast(
                            Sequelize.literal(
                                `proof_window_offset_perc + ${proofWindowDurationPerc} - ${currentEpochPerc}`,
                            ),
                            'DOUBLE',
                        ),
                        'timeLeftInSubmitProofWindow',
                    ],
                ],
            },
            where: {
                blockchainId: blockchain,
                lastCommitEpoch: {
                    [Sequelize.Op.eq]: Sequelize.literal(currentEpoch),
                },
                [Sequelize.Op.or]: [
                    {
                        lastProofEpoch: {
                            [Sequelize.Op.is]: null,
                        },
                    },
                    {
                        lastProofEpoch: {
                            [Sequelize.Op.lt]: Sequelize.literal(currentEpoch),
                        },
                    },
                ],
                proofWindowOffsetPerc: {
                    [Sequelize.Op.lte]: Sequelize.literal(`${currentEpochPerc}`),
                    [Sequelize.Op.gt]: Sequelize.literal(
                        `${currentEpochPerc} - ${proofWindowDurationPerc}`,
                    ),
                },
                epochsNumber: {
                    [Sequelize.Op.gt]: Sequelize.literal(currentEpoch),
                },
            },
            order: [[Sequelize.col('timeLeftInSubmitProofWindow'), 'ASC']],
            limit: 100,
            raw: true,
        });
    }

    async getNumberOfActiveServiceAgreements() {
        return this.model.count();
    }

    async getServiceAgreements(fromTokenId, batchSize) {
        return this.model.findAll({
            where: {
                tokenId: { [Sequelize.Op.gte]: fromTokenId },
            },
            limit: batchSize,
            order: [['token_id', 'asc']],
        });
    }
}

export default ServiceAgreementRepository;
