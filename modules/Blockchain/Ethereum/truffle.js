module.exports = {
    networks: {
        development: {
            host: 'localhost',
            port: 8545,
            gas: 4000000,
            network_id: '*', // Match any network id
        },

        ganache: {
        	host: 'localhost',
            port: 7545,
            gas: 4000000,
            network_id: '5777',
        },
    },
};
