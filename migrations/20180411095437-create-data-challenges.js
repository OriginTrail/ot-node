
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('data_challenges', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        time: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        block_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        answer: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dh_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        import_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        answered: {
            allowNull: true,
            type: Sequelize.INTEGER,
        },
        sent: {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            default: false,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('data_challenges'),
};
