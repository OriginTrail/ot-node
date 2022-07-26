module.exports = {
    up: (queryInterface, Sequelize) =>
        Promise.all([
            queryInterface.addColumn('publish_response', 'keyword', {
                type: Sequelize.STRING,
                allowNull: false,
            }),
            queryInterface.addColumn('resolve_response', 'keyword', {
                type: Sequelize.STRING,
                allowNull: false,
            }),
        ]),

    down: Promise.all([
        (queryInterface) => queryInterface.removeColumn('publish_response', 'keyword'),
        (queryInterface) => queryInterface.removeColumn('resolve_response', 'keyword'),
    ]),
};
