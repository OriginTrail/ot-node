import Sequelize from 'sequelize';

class ServiceAgreementRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.service_agreement;
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
            last_commit_epoch: lastCommitEpoch,
            last_proof_epoch: lastProofEpoch,
            hash_function_id: hashFunctionId,
            keyword,
            assertion_id: assertionId,
            state_index: stateIndex,
        });
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
}

export default ServiceAgreementRepository;
