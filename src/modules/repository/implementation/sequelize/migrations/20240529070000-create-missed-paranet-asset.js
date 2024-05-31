export const up = async ({ context: { queryInterface, Sequelize } }) => {
    await queryInterface.createTable('missed_paranet_asset', {
        id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        blockchain_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        ual: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        paranet_ual: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        knowledge_asset_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
    });
};

export const down = async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('missed_paranet_asset');
};
