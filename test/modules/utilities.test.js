
const { describe, it } = require('mocha');
// eslint-disable-next-line no-unused-vars
const should = require('should');
// eslint-disable-next-line no-unused-vars
const request = require('supertest');
const utilities = require('../../modules/utilities');
// eslint-disable-next-line no-unused-vars
const config = utilities.getConfig();


describe('The Utilities', () => {
    // it('config should exist', () => {
    //     let config = utilities.getConfig();
    //     should.exist(config);
    //     config.should.be.an.Object;
    //     (function () {
    //         JSON.stringify(config);
    //     }).should.not.throw();
    //     should.exist(config.NODE_IP);
    //     config.NODE_IP.should.not.be.empty();
    // });

    it('should return true if it is an empty object', () => {
        const obj2 = {};
        const result = utilities.isEmptyObject(obj2);
        result.should.be.true();
    });

    it('should return false if is not an empty object', () => {
        const obj1 = {
            name: 'OriginTrail',
        };
        const result = utilities.isEmptyObject(obj1);
        result.should.be.false();
    });

    it('should return random number', () => {
        const number = utilities.getRandomInt(10);
        number.should.be.an.Number;
        number.should.be.belowOrEqual(10);
    });

    it('should return random number in range min - max', () => {
        const number = utilities.getRandomIntRange(8, 17);
        number.should.be.aboveOrEqual(8, 'Number should be >= then min');
        number.should.be.belowOrEqual(17, 'Number should be <= then max');
    });

    it('should return true if two IP addresses are the same', () => {
        const ip1 = '127.0.0.1';
        const ip2 = '127.0.0.1';
        const result = utilities.isIpEqual(ip1, ip2);
        result.should.be.true;
    });

    it('should return false if two IP addresses are not the same', () => {
        const ip1 = '127.0.0.1';
        const ip2 = '192.168.0.0';
        const result = utilities.isIpEqual(ip1, ip2);
        result.should.be.false;
    });

    it('should return copied object', () => {
        const obj1 = { name: 'Mike', age: 30, city: 'New York' };
        obj1.should.be.deepEqual(utilities.copyObject(obj1));
    });
});
