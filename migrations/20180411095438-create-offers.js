
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('offers', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        data_lifespan: {
            type: Sequelize.INTEGER,
        },
        max_tender_time: {
            type: Sequelize.INTEGER,
        },
        min_number_of_applicants: {
            type: Sequelize.STRING,
        },
        price_in_tokens: {
            type: Sequelize.REAL,
        },
        data_size_in_bytes: {
            type: Sequelize.INTEGER,
        },
        root_hash: {
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('offers'),
};