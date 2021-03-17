module.exports = {
    up: async queryInterface => queryInterface.renameColumn('offers', 'trac_in_eth_used_for_price_calculation', 'trac_in_base_currency_used_for_price_calculation'),
    down: async queryInterface => queryInterface.renameColumn('offers', 'trac_in_base_currency_used_for_price_calculation', 'trac_in_eth_used_for_price_calculation'),
};
