module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.query(`
      UPDATE blockchain_data
      SET
      ot_contract_address = '0x8126e8a02bcae11a631d4413b9bd4f01f14e045d',
      token_contract_address = '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
      escrow_contract_address = '0xb4881e7406ce701e9641d3ddbd661a03e0c5158d',
      bidding_contract_address = '0x914c062d2f915e7937f7a4681988b33c1cccc7bd',
      reading_contract_address = '0x7f2555bb215fdaf03a91a89191713f6a54575f32'
      WHERE id = 1
    `),

    down: (queryInterface, Sequelize) => queryInterface.sequelize.query(`
      UPDATE blockchain_data
        SET
        ot_contract_address = '0x826b0e0b03f22c5e58557456bd8b8ede318c2e0a',
        token_contract_address = '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
        escrow_contract_address = '0xae389a81b1c53930c29954cbb3789864aefe7de6',
        bidding_contract_address = '0xdab7b4a3c414f3eeac0412ab9885fa8b9c9f5fa0',
        reading_contract_address = '0x70dc45492958c6fb09773bf189cbba5fceccf917'
        WHERE id = 1
    `),
};

