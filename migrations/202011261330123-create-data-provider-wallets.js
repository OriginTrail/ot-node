module.exports = {
    up: async (queryInterface, Sequelize) => queryInterface.createTable('data_provider_wallets', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        data_info_id: {
            type: Sequelize.INTEGER,
            references: {
                model: 'data_info',
                key: 'id',
            },
            allowNull: false,
            onUpdate: 'cascade',
            onDelete: 'cascade',
        },
        blockchain_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: async (queryInterface) => {
        await queryInterface.dropTable('data_provider_wallets');
    },
};
