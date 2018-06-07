
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('data_holders', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        import_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dh_wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dh_kademlia_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        m1: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        m2: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        e: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        sd: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        r1: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        r2: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        block_number: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('data_holders'),
};
