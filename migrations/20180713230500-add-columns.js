
module.exports = {
    up: (queryInterface, Sequelize) => [
        queryInterface.addColumn('data_info', 'data_size', Sequelize.INTEGER),
    ],
    down: (queryInterface, Sequelize) => [
        queryInterface.dropColumn('data_info', 'data_size'),
    ],
};
