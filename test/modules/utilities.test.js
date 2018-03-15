
const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const should = require('should');
const web3 = require('web3');
const utilities = require('../../modules/utilities')();

let config;

before('Get an instance of config', () => {
    config = utilities.getConfig();
});


describe('Utilitity method', () => {
    it('getConfig should exist with approriate key/values', () => {
        expect(config).to.have.property('NODE_IP');
        expect(config).to.have.property('DH_NODE_IP');
        expect(config).to.have.property('DH_NODE_PORT');
        expect(config).to.have.property('DH_WALLET');
        expect(config).to.have.property('DB_TYPE');
        expect(config).to.have.property('DB_USERNAME');
        expect(config).to.have.property('DB_PASSWORD');
        expect(config).to.have.property('DB_HOST');
        expect(config).to.have.property('DB_PORT');
        expect(config).to.have.property('DB_DATABASE');
        expect(config).to.have.property('MAX_PATH_LENGTH');
        expect(config).to.have.property('RPC_API_PORT');
        expect(config).to.have.property('IPC_API_PORT');
        expect(config).to.have.property('KADEMLIA_PORT');
        expect(config).to.have.property('WALLET_ID');
        expect(config).to.have.property('KADEMLIA_SEED_IP');
        expect(config).to.have.property('IS_KADEMLIA_BEACON');
        expect(config).to.have.property('REQUEST_TIMEOUT');
        expect(config).to.have.property('REMOTE_ACCESS');
        expect(config).to.have.property('blockchain');
        assert.equal(config.DB_TYPE, 'arango');
        assert.equal(config.blockchain.preferred_chain, 'ethereum');
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

        assert.deepEqual(utilities.sortObject(objA), sortedObjA, 'given and sorted object should be identical');
    });
});
