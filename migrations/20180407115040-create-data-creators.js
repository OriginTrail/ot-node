
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('data_creators', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        dc_wallet: {
            type: Sequelize.STRING,
        },
        dc_kademlia_id: {
            type: Sequelize.STRING,
        },
        public_key: {
            type: Sequelize.TEXT,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('data_creators'),
};
