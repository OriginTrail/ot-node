require('dotenv').config();

let bootstrap_nodes = [];
if (process.env.BOOTSTRAP_NODE) {
    bootstrap_nodes = process.env.BOOTSTRAP_NODE.split(',');
}

let import_whitelist = [];
if (process.env.IMPORT_WHITELIST) {
    import_whitelist = process.env.IMPORT_WHITELIST.split(',');
}

const selected_database = (process.env.GRAPH_DATABASE === 'neo4j') ? 2 : 1;
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('node_config', [{
        key: 'node_wallet',
        value: process.env.NODE_WALLET,
    },
    {
        key: 'node_private_key',
        value: process.env.NODE_PRIVATE_KEY,
    },
    {
        key: 'node_rpc_ip',
        value: process.env.NODE_IP,
    }, {
        key: 'node_port',
        value: process.env.NODE_PORT,
    }, {
        key: 'node_kademlia_id',
        value: '',
    },
    {
        key: 'selected_graph_database',
        value: selected_database,
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
        value: process.env.TRAVERSE_NAT_ENABLED,
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
        value: process.env.TEST_NETWORK_ENABLED,
    }, {
        key: 'ssl_authority_paths',
        value: '[]',
    }, {
        key: 'network_bootstrap_nodes',
        value: JSON.stringify(bootstrap_nodes),
    }, {
        key: 'solve_hashes',
        value: '0',
    },
    {
        key: 'remote_access_whitelist',
        value: JSON.stringify(import_whitelist),
    },
    {
        key: 'node_rpc_port',
        value: process.env.NODE_RPC_PORT,
    },
    {
        key: 'send_logs_to_origintrail',
        value: process.env.SEND_LOGS,
    },
    ], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('node_config', null, {}),
};
