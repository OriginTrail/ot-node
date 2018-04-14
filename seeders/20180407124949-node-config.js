module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('node_config', [{
        key: 'node_wallet',
        value: '0xE1E9c5379C5df627a8De3a951fA493028394A050',
    },
    {
        key: 'node_private_key',
        value: 'd67bb11304e908bec02cdeb457cb16773676a89efbb8bed96d5f66aa1b49da75',
    },
    {
        key: 'node_rpc_ip',
        value: '192.168.100.159',
    }, {
        key: 'node_port',
        value: '5278',
    }, {
        key: 'node_kademlia_id',
        value: '',
    },
    {
        key: 'is_beacon',
        value: 'false',
    },
    {
        key: 'kademlia_seed_ip',
        value: '',
    },
    {
        key: 'selected_graph_database',
        value: '1',
    },
    {
        key: 'selected_blockchain',
        value: '1',
    },
    {
        key: 'request_timeout',
        value: '10000',
    },
    {
        key: 'ssl_keypath',
        value: 'kademlia.key',
    },
    {
        key: 'ssl_certificate_path',
        value: 'kademlia.crt',
    },
    {
        key: 'private_extended_key_path',
        value: 'kademlia.prv',
    },
    {
        key: 'child_derivation_index',
        value: '',
    },
    {
        key: 'cpus',
        value: '1',
    },
    {
        key: 'embedded_wallet_directory',
        value: 'wallet.dat',
    },
    {
        key: 'embedded_peercache_path',
        value: 'peercache',
    },
    {
        key: 'onion_virtual_port',
        value: '443',
    }, {
        key: 'traverse_nat_enabled',
        value: '0',
    }, {
        key: 'traverse_port_forward_ttl',
        value: '0',
    }, {
        key: 'verbose_logging',
        value: '0',
    }, {
        key: 'control_port_enabled',
        value: '0',
    }, {
        key: 'control_port',
        value: '5279',
    }, {
        key: 'control_sock_enabled',
        value: 'peercache',
    }, {
        key: 'control_sock',
        value: '',
    }, {
        key: 'onion_enabled',
        value: '0',
    }, {
        key: 'test_network',
        value: '1',
    }, {
        key: 'ssl_authority_paths',
        value: '[]',
    }, {
        key: 'network_bootstrap_nodes',
        value: '["http://192.168.100.162/#27a975a7fb6a177c9af38c155b17208948cb8776"]',
    }, {
        key: 'is_bootstrap_node',
        value: '0',
    }, {
        key: 'solve_hashes',
        value: '0',
    },
    {
        key: 'remote_access_whitelist',
        value: '[]',
    },
    {
        key: 'node_rpc_port',
        value: '8900',
    },
    {
        key: 'dh_wallet',
        value: '0x1a2C6214dD5A52f73Cb5C8F82ba513DA1a0C8fcE',
    },
    ], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('node_config', null, {}),
};
