export const up = async ({ context: { queryInterface, Sequelize } }) => {
    await queryInterface.createTable('missed_paranet_asset', {
        id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        blockchainId: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        ual: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        paranetUal: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        knowledgeAssetId: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    });
};

export const down = async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('missed_paranet_asset');
};
