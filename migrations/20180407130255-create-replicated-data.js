
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('replicated_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        dh_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        import_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        offer_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_private_key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_public_key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('replicated_data'),
};
