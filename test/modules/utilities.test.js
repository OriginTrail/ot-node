const { describe, it, after } = require('mocha');
const { assert, expect } = require('chai');
const fs = require('fs');
const Utilities = require('../../modules/Utilities');
const config = require('../../modules/Config');

config.ssl_keypath = 'myKey.key';
config.ssl_certificate_path = 'myCert.crt';

describe('Utilities module', () => {
    it('isEmptyObject ', () => {
        assert.isTrue(Utilities.isEmptyObject({}));
        assert.isFalse(Utilities.isEmptyObject([]));
        assert.isFalse(Utilities.isEmptyObject(0));
        const myObj = {
            myKey: 'Some Value',
        };
        assert.isFalse(Utilities.isEmptyObject(myObj));
    });

    it('getRandomInt ', () => {
        const max11 = Utilities.getRandomInt(11);
        assert.isAtLeast(max11, 0) && assert.isAtMost(max11, 11);
    });

    it('getRandomIntRange ', () => {
        const max15max33 = Utilities.getRandomIntRange(15, 33);
        assert.isAtLeast(max15max33, 15) && assert.isAtMost(max15max33, 33);
    });

    it('isIpEqual() ', () => {
        assert.isTrue(Utilities.isIpEqual('10.234.52.124', '10.234.52.124'));
        assert.isFalse(Utilities.isIpEqual('192.168.0.1', '10.234.52.124'));
    });

    it('generateSelfSignedCertificate()', async () => {
        await Utilities.generateSelfSignedCertificate();
        const myKey = fs.readFileSync(`${__dirname}/../../keys/${config.ssl_keypath}`, 'utf8');
        expect(myKey).to.be.a('string');
        assert.isTrue(/^\r?\n*-----BEGIN RSA PRIVATE KEY-----\r?\n/.test(myKey));
        assert.isTrue(/\r?\n-----END RSA PRIVATE KEY-----\r?\n*$/.test(myKey));
        const myCert = fs.readFileSync(`${__dirname}/../../keys/${config.ssl_certificate_path}`, 'utf8');
        expect(myCert).to.be.a('string');
        assert.isTrue(/^\r?\n*-----BEGIN CERTIFICATE-----\r?\n/.test(myCert));
        assert.isTrue(/\r?\n-----END CERTIFICATE-----\r?\n*$/.test(myCert));
    });

    after('cleanup', () => {
        fs.unlink(`${__dirname}/../../keys/${config.ssl_keypath}`, (error) => {
            if (error) {
                throw error;
            }
        });
        fs.unlink(`${__dirname}/../../keys/${config.ssl_certificate_path}`, (error) => {
            if (error) {
                throw error;
            }
        });
    });
});
