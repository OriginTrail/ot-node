
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('network_query_responses', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        query_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        node_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        imports: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_size: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_price: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        stake_factor: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('network_query_responses'),
};
