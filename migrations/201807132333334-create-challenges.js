
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('challenges', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        data_set_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dh_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dh_identity: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        offer_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        block_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        answer: {
            allowNull: true,
            type: Sequelize.STRING,
        },
        expected_answer: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        start_time: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        end_time: {
            allowNull: true,
            type: Sequelize.INTEGER,
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: queryInterface => queryInterface.dropTable('challenges'),
};
