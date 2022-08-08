module.exports = {
  up: (queryInterface, Sequelize) => Promise.all([queryInterface.addColumn(
      'assertions',
      'triple_store',
      {
        type: Sequelize.STRING,
        allowNull: true,
      }
    ),
    queryInterface.addColumn(
      'assertions',
      'status',
      {
        type: Sequelize.STRING,
        allowNull: true,
      }
    )]),

  down: (queryInterface) => Promise.all([queryInterface.removeColumn(
      'assertions',
      'triple_store',
    ),
    queryInterface.removeColumn(
      'assertions',
      'status',
    )])
};
