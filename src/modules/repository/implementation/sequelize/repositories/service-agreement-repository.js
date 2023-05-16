import Sequelize from 'sequelize';

class ServiceAgreementRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.service_agreement;
    }

    async updateServiceAgreementEpochsNumber(agreementId, epochsNumber) {
        return this.model.update(
            { epochs_number: epochsNumber },
            {
                where: { agreement_id: agreementId },
            },
        );
    }

    async removeServiceAgreements(agreementIds) {
        return this.model.destroy({
            where: { agreement_id: { [Sequelize.Op.in]: agreementIds } },
        });
    }

    async updateServiceAgreementRecord(
        blockchainId,
        contract,
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
        lastCommitEpoch,
        lastProofEpoch,
    ) {
        return this.model.upsert({
            blockchain_id: blockchainId,
            asset_storage_contract_address: contract,
            token_id: tokenId,
            agreement_id: agreementId,
            start_time: startTime,
            epochs_number: epochsNumber,
            epoch_length: epochLength,
            score_function_id: scoreFunctionId,
            proof_window_offset_perc: proofWindowOffsetPerc,
            hash_function_id: hashFunctionId,
            keyword,
            assertion_id: assertionId,
            state_index: stateIndex,
            last_commit_epoch: lastCommitEpoch,
            last_proof_epoch: lastProofEpoch,
        });
    }

    async bulkCreateServiceAgreementRecords(serviceAgreements) {
        return this.model.bulkCreate(serviceAgreements, {
            validate: true,
        });
    }

    async updateServiceAgreementLastCommitEpoch(agreementId, lastCommitEpoch) {
        return this.model.update(
            { last_commit_epoch: lastCommitEpoch },
            {
                where: {
                    agreement_id: agreementId,
                },
            },
        );
    }

    async updateServiceAgreementLastProofEpoch(agreementId, lastProofEpoch) {
        return this.model.update(
            { last_proof_epoch: lastProofEpoch },
            {
                where: {
                    agreement_id: agreementId,
                },
            },
        );
    }

    async removeServiceAgreementRecord(blockchainId, contract, tokenId) {
        await this.model.destroy({
            where: {
                blockchain_id: blockchainId,
                asset_storage_contract_address: contract,
                token_id: tokenId,
            },
        });
    }

    getEligibleAgreementsForSubmitCommit(timestampSeconds, blockchain, commitWindowDurationPerc) {
        const currentEpoch = `FLOOR((${timestampSeconds} - start_time) / epoch_length)`;
        const currentEpochPerc = `((${timestampSeconds} - start_time) % epoch_length) / epoch_length * 100`;

        return this.model.findAll({
            attributes: {
                include: [
                    [Sequelize.literal(currentEpoch), 'current_epoch'],
                    [
                        Sequelize.cast(
                            Sequelize.literal(`${commitWindowDurationPerc} - ${currentEpochPerc}`),
                            'DOUBLE',
                        ),
                        'time_left_in_submit_commit_window',
                    ],
                ],
            },
            where: {
                blockchain_id: blockchain,
                [Sequelize.Op.or]: [
                    {
                        last_commit_epoch: {
                            [Sequelize.Op.is]: null,
                        },
                    },
                    {
                        last_commit_epoch: {
                            [Sequelize.Op.lt]: Sequelize.literal(currentEpoch),
                        },
                    },
                ],
                [Sequelize.Op.and]: Sequelize.literal(
                    `${currentEpochPerc} < ${commitWindowDurationPerc}`,
                ),
                epochs_number: {
                    [Sequelize.Op.gt]: Sequelize.literal(currentEpoch),
                },
            },
            order: [[Sequelize.col('time_left_in_submit_commit_window'), 'ASC']],
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
                    [Sequelize.literal(currentEpoch), 'current_epoch'],
                    [
                        Sequelize.cast(
                            Sequelize.literal(
                                `proof_window_offset_perc + ${proofWindowDurationPerc} - ${currentEpochPerc}`,
                            ),
                            'DOUBLE',
                        ),
                        'time_left_in_submit_proof_window',
                    ],
                ],
            },
            where: {
                blockchain_id: blockchain,
                last_commit_epoch: {
                    [Sequelize.Op.eq]: Sequelize.literal(currentEpoch),
                },
                [Sequelize.Op.or]: [
                    {
                        last_proof_epoch: {
                            [Sequelize.Op.is]: null,
                        },
                    },
                    {
                        last_proof_epoch: {
                            [Sequelize.Op.lt]: Sequelize.literal(currentEpoch),
                        },
                    },
                ],
                proof_window_offset_perc: {
                    [Sequelize.Op.lte]: Sequelize.literal(`${currentEpochPerc}`),
                    [Sequelize.Op.gt]: Sequelize.literal(
                        `${currentEpochPerc} - ${proofWindowDurationPerc}`,
                    ),
                },
                epochs_number: {
                    [Sequelize.Op.gt]: Sequelize.literal(currentEpoch),
                },
            },
            order: [[Sequelize.col('time_left_in_submit_proof_window'), 'ASC']],
            limit: 100,
            raw: true,
        });
    }
}

export default ServiceAgreementRepository;
