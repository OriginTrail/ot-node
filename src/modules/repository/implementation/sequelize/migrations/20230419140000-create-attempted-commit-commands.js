export const up = async ({ context: { queryInterface, Sequelize } }) => {
    await queryInterface.createTable('attempted_commit_commands', {
        blockchain_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        asset_storage_contract_address: {
            type: Sequelize.STRING(42),
            primaryKey: true,
        },
        token_id: {
            type: Sequelize.INTEGER.UNSIGNED,
            primaryKey: true,
        },
        agreement_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        epoch: {
            type: Sequelize.SMALLINT.UNSIGNED,
            primaryKey: true,
        },
        status: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        tx_hash: {
            type: Sequelize.STRING,
        },
    });
};

export const down = async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('attempted_commit_commands');
};
