const {
    describe, it, after, before,
} = require('mocha');
const { assert, expect } = require('chai');
const fs = require('fs');
var models = require('../../models');
const deasync = require('deasync-promise');
const Utilities = require('../../modules/Utilities');
const config = require('../../modules/Config');
const Storage = require('../../modules/Storage');
const kadence = require('@kadenceproject/kadence');
const databaseData = require('./test_data/database-data.js');

let myConfig;

describe('Utilities module', () => {
    before('loadConfig() should populate myConfig object', () => {
        Storage.models = deasync(models.sequelize.sync()).models;

        Utilities.loadConfig().then((result) => {
            myConfig = result;
            assert.hasAllKeys(
                result, ['node_wallet', 'node_private_key', 'node_rpc_ip', 'node_port',
                    'node_kademlia_id', 'selected_graph_database', 'selected_blockchain', 'request_timeout', 'ssl_keypath',
                    'ssl_certificate_path', 'private_extended_key_path', 'child_derivation_index', 'cpus', 'embedded_wallet_directory',
                    'embedded_peercache_path', 'onion_virtual_port', 'traverse_nat_enabled', 'traverse_port_forward_ttl', 'verbose_logging',
                    'control_port_enabled', 'control_port', 'control_sock_enabled', 'control_sock', 'onion_enabled', 'test_network',
                    'ssl_authority_paths', 'network_bootstrap_nodes', 'solve_hashes', 'remote_access_whitelist', 'node_rpc_port',
                    'dh_min_price', 'dh_max_price', 'dh_max_data_size_bytes', 'dh_max_stake'],
                'Some config items are missing',
            );
        });
    });

    it('loadSelectedBlockchainInfo()', async () => {
        const myResult = await Utilities.loadSelectedBlockchainInfo();
        assert.hasAllKeys(myResult, ['blockchain_title', 'id', 'network_id', 'gas_limit',
            'gas_price', 'ot_contract_address', 'token_contract_address', 'escrow_contract_address',
            'rpc_node_host', 'rpc_node_port', 'wallet_address', 'wallet_private_key', 'bidding_contract_address']);
        assert.equal(myResult.blockchain_title, 'Ethereum');
    });

    it('isEmptyObject check', () => {
        assert.isTrue(Utilities.isEmptyObject({}));
        assert.isFalse(Utilities.isEmptyObject([]));
        assert.isFalse(Utilities.isEmptyObject(0));
        const myObj = {
            myKey: 'Some Value',
        };
        assert.isFalse(Utilities.isEmptyObject(myObj));
    });

    it('getRandomInt check', () => {
        const max11 = Utilities.getRandomInt(11);
        assert.isAtLeast(max11, 0);
        assert.isAtMost(max11, 11);
    });

    it('getRandomIntRange check', () => {
        const max15max33 = Utilities.getRandomIntRange(15, 33);
        assert.isAtLeast(max15max33, 15);
        assert.isAtMost(max15max33, 33);
    });

    it('getRandomString check', () => {
        const mediumLong = 25;
        const randomStr = Utilities.getRandomString(mediumLong);
        assert.typeOf(randomStr, 'string');
        assert.isTrue(randomStr.length === 25);
    });

    it('isIpEqual() check', () => {
        assert.isTrue(Utilities.isIpEqual('10.234.52.124', '10.234.52.124'));
        assert.isFalse(Utilities.isIpEqual('192.168.0.1', '10.234.52.124'));
    });

    it('generateSelfSignedCertificate() should gen kademlia.key and kademlia.crt', async () => {
        const result = await Utilities.generateSelfSignedCertificate();
        const myKey = fs.readFileSync(`${__dirname}/../../keys/${myConfig.ssl_keypath}`, 'utf8');
        expect(myKey).to.be.a('string');
        assert.isTrue(/^\r?\n*-----BEGIN RSA PRIVATE KEY-----\r?\n/.test(myKey));
        assert.isTrue(/\r?\n-----END RSA PRIVATE KEY-----\r?\n*$/.test(myKey));
        const myCert = fs.readFileSync(`${__dirname}/../../keys/${myConfig.ssl_certificate_path}`, 'utf8');
        expect(myCert).to.be.a('string');
        assert.isTrue(/^\r?\n*-----BEGIN CERTIFICATE-----\r?\n/.test(myCert));
        assert.isTrue(/\r?\n-----END CERTIFICATE-----\r?\n*$/.test(myCert));
    });

    it('saveToConfig() ', () => {
        const newVerboseLogging = 7;
        Utilities.saveToConfig('verbose_logging', newVerboseLogging).then(() => {
            // reload config and check the value
            Utilities.loadConfig().then((config) => {
                assert(config.verbose_logging, 7);
            }).catch((error) => {
                console.log(error);
            });
        }).catch((error) => {
            console.log(error); // TODO handle error propertly
        });
    });

    it('createPrivateExtendedKey()', () => {
        Utilities.createPrivateExtendedKey(kadence);
        const myPrvKey = fs.readFileSync(`${__dirname}/../../keys/${myConfig.private_extended_key_path}`, 'utf8');
        assert.typeOf(myPrvKey, 'string');
        assert.isTrue(myPrvKey.length > 0);
    });

    it('loadSelectedDatabaseInfo()', async () => {
        const myResult = await Utilities.loadSelectedDatabaseInfo();
        assert.hasAllKeys(myResult, ['id', 'database_system', 'username', 'password',
            'host', 'port', 'max_path_length', 'database']);
        assert.equal(myResult.database_system, 'arango_db');
    });


    it('sortObject() should return object sorted by keys', () => {
        const unsorted = {
            b: 'asdsad',
            36: 'masdas',
            '-1': 'minus one',
            a: 'dsfdsfsdf',
            A: 'dsfdsfsdf',
            p: '12345',
            _: '???????',
            D: {
                b: 'asdsad', c: 'masdas', a: 'dsfdsfsdf', p: 'mmmmmmmm', _: '???????',
            },
        };

        const expectedSorted = {
            36: 'masdas',
            '-1': 'minus one',
            _: '???????',
            a: 'dsfdsfsdf',
            A: 'dsfdsfsdf',
            b: 'asdsad',
            D:
                {
                    _: '???????',
                    a: 'dsfdsfsdf',
                    b: 'asdsad',
                    c: 'masdas',
                    p: 'mmmmmmmm',
                },
            p: '12345',
        };

        const actualSorted = Utilities.sortObject(unsorted);
        // compare values at indexes
        for (let index = 0; index < Object.keys(expectedSorted).length; index += 1) {
            assert.equal(actualSorted.index, expectedSorted.index);
        }
    });

    it('copyObject() check', () => {
        const edgeOne = databaseData.edges[0];
        const copyEdgeOne = Utilities.copyObject(edgeOne);
        assert.deepEqual(edgeOne, copyEdgeOne);
    });

    it('executeCallback() callback not defined scenario', async () => {
        // helper function
        function first(timeInterval) {
            setTimeout(() => function () {
                console.log('Helper function log');
            }, 1000);
        }
        try {
            const result = await Utilities.executeCallback(first(), false);
            assert.isUndefined(result);
        } catch (error) {
            console.log(error);
        }
    });

    after('cleanup', () => {
        const keyToDelete = `${__dirname}/../../keys/${myConfig.ssl_keypath}`;
        const certToDelete = `${__dirname}/../../keys/${myConfig.ssl_certificate_path}`;
        const prvKeyToDelete = `${__dirname}/../../keys/${myConfig.private_extended_key_path}`;

        try {
            fs.unlinkSync(keyToDelete);
        } catch (error) {
            console.log(error);
        }
        try {
            fs.unlinkSync(certToDelete);
        } catch (error) {
            console.log(error);
        }
        try {
            fs.unlinkSync(prvKeyToDelete);
        } catch (error) {
            console.log(error);
        }
        myConfig = {};
    });
});
