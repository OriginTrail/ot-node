module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.query(`
      INSERT INTO node_config
      (key, value) VALUES ('reverse_tunnel_address', 'diglet.origintrail.io'), ('reverse_tunnel_port', 8443)
    `),

    down: (queryInterface, Sequelize) => queryInterface.sequelize.query(`
      DELETE FROM node_config WHERE key IN ('reverse_tunnel_address', 'reverse_tunnel_port')
    `),
};
