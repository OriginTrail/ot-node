export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('shard', 'sha256_blob', {
        type: Sequelize.BLOB,
    });

    const shards = await queryInterface.sequelize.query(
        'SELECT peer_id, blockchain_id, sha256 FROM shard',
        { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    for (const shard of shards) {
        const sha256Blob = Buffer.from(shard.sha256, 'hex');

        // eslint-disable-next-line no-await-in-loop
        await queryInterface.sequelize.query(
            'UPDATE shard SET sha256_blob = :sha256Blob WHERE peer_id = :peerId AND blockchain_id = :blockchainId',
            {
                replacements: {
                    sha256Blob,
                    peerId: shard.peer_id,
                    blockchainId: shard.blockchain_id,
                },
                type: queryInterface.sequelize.QueryTypes.UPDATE,
            },
        );
    }
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('shard', 'sha256_blob');
}
