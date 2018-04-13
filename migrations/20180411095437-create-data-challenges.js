
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('data_challenges', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        time: {
            type: Sequelize.INTEGER,
        },
        block_id: {
            type: Sequelize.INTEGER,
        },
        answer: {
            type: Sequelize.STRING,
        },
        dh_id: {
            type: Sequelize.STRING,
        },
        import_id: {
            type: Sequelize.STRING,
        },
        answered: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('data_challenges'),
};
