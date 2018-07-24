module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.query(`
      UPDATE node_config
      SET 
      value = '20000'
      WHERE key = 'request_timeout'`),

    down: (queryInterface, Sequelize) => queryInterface.sequelize.query(`
      UPDATE node_config
      SET 
      value = '10000'
      WHERE key = 'request_timeout'`),
};
