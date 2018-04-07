'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('data_infos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      data_id: {
        type: Sequelize.INTEGER
      },
      total_documents: {
        type: Sequelize.INTEGER
      },
      total_data_blocks: {
        type: Sequelize.INTEGER
      },
      root_hash: {
        type: Sequelize.STRING
      },
      import_timestamp: {
        type: Sequelize.DATE
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('data_infos');
  }
};