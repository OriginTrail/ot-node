'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('offers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      offer_id: {
        type: Sequelize.STRING
      },
      data_lifespan: {
        type: Sequelize.INTEGER
      },
      start_tender_time: {
        type: Sequelize.INTEGER
      },
      tender_duration: {
        type: Sequelize.INTEGER
      },
      min_number_applicants: {
        type: Sequelize.INTEGER
      },
      price_tokens: {
        type: Sequelize.REAL
      },
      data_size_bytes: {
        type: Sequelize.INTEGER
      },
      root_hash: {
        type: Sequelize.STRING
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
    return queryInterface.dropTable('offers');
  }
};