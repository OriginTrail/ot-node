
module.exports = {
    up: (queryInterface, Sequelize) => [
        queryInterface.addColumn('data_info', 'data_size', Sequelize.INTEGER),
        queryInterface.addColumn('data_challenges', 'sent', Sequelize.TINYINT),
    ],
    down: (queryInterface, Sequelize) => [
        queryInterface.dropColumn('data_info', 'data_size'),
        queryInterface.dropColumn('data_challenges', 'sent'),
    ],
};
