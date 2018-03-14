
const { describe, before, it } = require('mocha');
const { assert } = require('chai');
const should = require('should');
const web3 = require('web3');
const utilities = require('../../modules/utilities')();

let config;

before('Get an instance of config', () => {
    config = utilities.getConfig();
    console.log(config);
    console.log("____");
});


describe('Utilitity method', () => {
    it('getConfig should exist with approriate key/values', () => {
        assert.exists(config);
        assert.exists(config.NODE_IP);
        assert.isNotEmpty(config.NODE_IP);
        assert.exists(config.DH_NODE_IP);
        assert.exists(config.DH_NODE_PORT);
        assert.exists(config.DH_WALLET);
        assert.exists(config.DB_TYPE);
        assert.equal(config.DB_TYPE, 'arango');
        assert.exists(config.DB_USERNAME);
        assert.exists(config.DB_PASSWORD);
        assert.exists(config.DB_HOST);
        assert.exists(config.DB_PORT);
        assert.exists(config.DB_DATABASE);
        assert.exists(config.MAX_PATH_LENGTH);
        assert.exists(config.RPC_API_PORT);
        assert.exists(config.IPC_API_PORT);
        assert.exists(config.KADEMLIA_PORT);
        assert.exists(config.WALLET_ID);
        assert.exists(config.KADEMLIA_SEED_IP);
        assert.exists(config.KADEMLIA_SEED_PORT);
        assert.exists(config.IS_KADEMLIA_BEACON);
        assert.exists(config.REQUEST_TIMEOUT);
        assert.exists(config.REMOTE_ACCESS);
        assert.exists(config.blockchain);
        assert.equal(config.blockchain.preferred_chain, 'ethereum');
        assert.exists(config.blockchain.settings);
        assert.isTrue(web3.utils.isAddress(config.blockchain.settings.ethereum.token_contract));
        assert.isTrue(web3.utils.isAddress(config.blockchain.settings.ethereum.escrow_contract));
    });

    it('isEmptyObject should return true if it is an empty object', () => {
        const obj2 = {};
        const result = utilities.isEmptyObject(obj2);
        result.should.be.true();
    });

    it('isEmptyObject should return false if is not an empty object', () => {
        const obj1 = {
            name: 'OriginTrail',
        };
        const result = utilities.isEmptyObject(obj1);
        result.should.be.false;
    });

    it('getRandomInt should return random number', () => {
        const number = utilities.getRandomInt(10);
        number.should.be.an.Number;
        number.should.be.belowOrEqual(10);
    });

    it('getRandomIntRange should return random number in range min - max', () => {
        const number = utilities.getRandomIntRange(8, 17);
        number.should.be.an.Number;
        number.should.be.aboveOrEqual(8, 'Number should be >= then min');
        number.should.be.belowOrEqual(17, 'Number should be <= then max');
    });

    it('isIpEqual should return true if two IP addresses are the same', () => {
        const ip1 = '127.0.0.1';
        const ip2 = '127.0.0.1';
        const result = utilities.isIpEqual(ip1, ip2);
        result.should.be.true;
    });

    it('isIpEqual should return false if two IP addresses are not the same', () => {
        const ip1 = '127.0.0.1';
        const ip2 = '192.168.0.0';
        const result = utilities.isIpEqual(ip1, ip2);
        result.should.be.false;
    });

    it('copyObject should return copied object', () => {
        const obj1 = { name: 'Mike', age: 30, city: 'New York' };
        obj1.should.be.deepEqual(utilities.copyObject(obj1));
    });

    it('sortObject should return object sorted by keys', () => {
        const objA = {
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

        const sortedObjA = {
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

        assert.deepEqual(objA, sortedObjA, 'given and sorted object should be identical');
    });
});
