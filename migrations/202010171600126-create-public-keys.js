
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('public_keys', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        public_key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        node_erc: {
            allowNull: true,
            type: Sequelize.STRING,
        },
        node_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        timestamp: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
    }),
    down: queryInterface => queryInterface.dropTable('public_keys'),
};
