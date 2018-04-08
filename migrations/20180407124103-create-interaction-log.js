
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('interaction_logs', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        actor_wallet: {
            type: Sequelize.STRING,
        },
        action_type: {
            type: Sequelize.STRING,
        },
        action_time: {
            type: Sequelize.DATE,
        },
        transaction_hash: {
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('interaction_logs'),
};
