require('dotenv').config();
const uuidv4 = require('uuid/v4');

let bootstrap_nodes = [];
if (process.env.BOOTSTRAP_NODE) {
    bootstrap_nodes = process.env.BOOTSTRAP_NODE.split(',');
} else {
    const error = 'Valid BOOTSTRAP_NODE list is required for a node to run. Please check your .env file.';
    console.error(error);
    throw Error(error);
}

let import_whitelist = [];
if (process.env.IMPORT_WHITELIST) {
    import_whitelist = process.env.IMPORT_WHITELIST.split(',');
}

if (!process.env.NODE_WALLET || !process.env.NODE_PRIVATE_KEY) {
    const error = 'Valid NODE_WALLET and NODE_PRIVATE_KEY is required for a node to run. Please check your .env file.';
    console.error(error);
    throw Error(error);
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
        value: process.env.NODE_IP ? process.env.NODE_IP : '127.0.0.1',
    }, {
        key: 'node_port',
        value: process.env.NODE_PORT ? process.env.NODE_PORT : '5278',
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
        value: '20000',
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
        value: '4043',
    }, {
        key: 'traverse_nat_enabled',
        value: process.env.TRAVERSE_NAT_ENABLED ? process.env.TRAVERSE_NAT_ENABLED : '0',
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
        value: process.env.TEST_NETWORK_ENABLED ? process.env.TEST_NETWORK_ENABLED : '1',
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
        value: process.env.NODE_RPC_PORT ? process.env.NODE_RPC_PORT : '8900',
    },
    {
        key: 'send_logs_to_origintrail',
        value: process.env.SEND_LOGS ? process.env.SEND_LOGS : '1',
    },
    {
        key: 'enable_debug_logs_level',
        value: process.env.LOGS_LEVEL_DEBUG ? process.env.LOGS_LEVEL_DEBUG : '1',
    },
    {
        key: 'is_bootstrap_node',
        value: false,
    },
    {
        key: 'houston_password',
        value: uuidv4(),
    },
    {
        key: 'dh_min_price',
        value: '10',
    },
    {
        key: 'dh_max_price',
        value: '1000',
    },
    {
        key: 'dh_max_stake',
        value: '1000',
    },
    {
        key: 'remote_control_enabled',
        value: '1',
    },
    {
        key: 'remote_control_port',
        value: process.env.NODE_REMOTE_CONTROL_PORT ?
            process.env.NODE_REMOTE_CONTROL_PORT : 3000,
    },
    {
        key: 'dh_stake_factor',
        value: '250000000000', // [mTRAC / byte / min]
    },
    {
        key: 'read_stake_factor',
        value: '1',
    },
    {
        key: 'dh_max_time_mins',
        value: '100000',
    },
    {
        key: 'dh_price',
        value: '250000000000', // [mTRAC / byte / min]
    },
    {
        key: 'total_escrow_time_in_milliseconds',
        value: '86400000',
    },
    {
        key: 'max_token_amount_per_dh',
        value: '500000000000', // [mTRAC / byte / min]
    },
    {
        key: 'dh_min_stake_amount',
        value: '100000000000', // [mTRAC / byte / min]
    },
    {
        key: 'dh_min_reputation',
        value: 0,
    },
    {
        key: 'probability_threshold',
        value: '10',
    },
    {
        key: 'reverse_tunnel_address',
        value: 'diglet.origintrail.io',
    },
    {
        key: 'reverse_tunnel_port',
        value: '8443',
    },
    {
        key: 'network_id',
        value: process.env.NETWORK_ID ? process.env.NETWORK_ID : 'Development',
    },
    ], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('node_config', null, {}),
};
