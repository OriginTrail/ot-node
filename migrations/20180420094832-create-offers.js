
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('offers', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        data_lifespan: {
            type: Sequelize.INTEGER,
        },
        start_tender_time: {
            type: Sequelize.INTEGER,
        },
        tender_duration: {
            type: Sequelize.INTEGER,
        },
        min_number_applicants: {
            type: Sequelize.INTEGER,
        },
        price_tokens: {
            type: Sequelize.STRING,
        },
        data_size_bytes: {
            type: Sequelize.STRING,
        },
        replication_number: {
            type: Sequelize.INTEGER,
        },
        root_hash: {
            type: Sequelize.STRING,
        },
        max_token_amount: {
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('offers'),
};
