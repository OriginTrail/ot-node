export async function up({ context: { queryInterface } }) {
    // Composite index for common columns used in calculations and conditions
    await queryInterface.addIndex(
        'service_agreements',
        ['blockchainId', 'start_time', 'epoch_length'],
        {
            name: 'idx_sa_common_fields',
        },
    );

    // Indexes for getEligibleAgreementsForSubmitCommit
    await queryInterface.addIndex('service_agreements', ['blockchainId', 'lastCommitEpoch'], {
        name: 'idx_sa_commit_blockchain_commit_epoch',
    });

    await queryInterface.addIndex('service_agreements', ['epochsNumber'], {
        name: 'idx_sa_commit_epochs_number',
    });

    // Indexes for getEligibleAgreementsForSubmitProof
    await queryInterface.addIndex(
        'service_agreements',
        ['blockchainId', 'lastCommitEpoch', 'lastProofEpoch'],
        {
            name: 'idx_sa_proof_commit_proof_epoch',
        },
    );

    await queryInterface.addIndex('service_agreements', ['proofWindowOffsetPerc'], {
        name: 'idx_sa_proof_window_offset_perc',
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeIndex('service_agreements', 'idx_sa_proof_window_offset_perc');
    await queryInterface.removeIndex('service_agreements', 'idx_sa_proof_commit_proof_epoch');
    await queryInterface.removeIndex('service_agreements', 'idx_sa_commit_epochs_number');
    await queryInterface.removeIndex('service_agreements', 'idx_sa_commit_blockchain_commit_epoch');
    await queryInterface.removeIndex('service_agreements', 'idx_sa_common_fields');
}
