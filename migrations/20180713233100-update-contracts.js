module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.query(`
      UPDATE blockchain_data
      SET 
      ot_contract_address = '0x826b0e0b03f22c5e58557456bd8b8ede318c2e0a',
      token_contract_address = '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
      escrow_contract_address = '0xae389a81b1c53930c29954cbb3789864aefe7de6',
      bidding_contract_address = '0xdab7b4a3c414f3eeac0412ab9885fa8b9c9f5fa0',
      reading_contract_address = '0x70dc45492958c6fb09773bf189cbba5fceccf917'
      WHERE id = 1
    `),

    down: (queryInterface, Sequelize) => queryInterface.sequelize.query(`
      UPDATE blockchain_data
      SET 
      ot_contract_address = '0x826b0e0b03f22c5e58557456bd8b8ede318c2e0a',
      token_contract_address = '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
      escrow_contract_address = '0x679e464d5efe52632cd0747a31dbc05ea604f73e',
      bidding_contract_address = '0xb4b3a74018f3ee53ff435ccf8cbc018c54207a86',
      reading_contract_address = '0x2f6857cfb2c8830d70b3bb04e5bbdfb35c7dd4b1'
      WHERE id = 1
    `),
};

