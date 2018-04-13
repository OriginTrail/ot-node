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

let myConfig;

// config.ssl_keypath = 'myKey.key';
// config.ssl_certificate_path = 'myCert.crt';

describe.only('Utilities module', () => {
    before('loadConfig() ', () => {
        Storage.models = deasync(models.sequelize.sync()).models;
        Utilities.loadConfig().then((result) => {
            // console.log(result);
            myConfig = result;
        });
    });

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

    it('generateSelfSignedCertificate()', () => {
        Utilities.generateSelfSignedCertificate().then((result) => {
            const myKey = fs.readFileSync(`${__dirname}/../../keys/${myConfig.ssl_keypath}`, 'utf8');
            expect(myKey).to.be.a('string');
            assert.isTrue(/^\r?\n*-----BEGIN RSA PRIVATE KEY-----\r?\n/.test(myKey));
            assert.isTrue(/\r?\n-----END RSA PRIVATE KEY-----\r?\n*$/.test(myKey));
            const myCert = fs.readFileSync(`${__dirname}/../../keys/${myConfig.ssl_certificate_path}`, 'utf8');
            expect(myCert).to.be.a('string');
            assert.isTrue(/^\r?\n*-----BEGIN CERTIFICATE-----\r?\n/.test(myCert));
            assert.isTrue(/\r?\n-----END CERTIFICATE-----\r?\n*$/.test(myCert));
        });
    });

    it.skip('saveToConfig() ', () => {
        const newVerboseLogging = 5;
        Utilities.saveToConfig('verbose_logging', newVerboseLogging).then(() => {
            console.log('OK');
        });
        // Utilities.loadConfig().then((result) => {
        //         assert.isTrue(result.newVerboseLogging, newVerboseLogging);
        // });
    });

    // after('cleanup', () => {
    //     let keyToDelete = `${__dirname}/../../keys/${myConfig.ssl_keypath}`;
    //     let certToDelete = `${__dirname}/../../keys/${myConfig.ssl_certificate_path}`;
    //     fs.unlinkSync(keyToDelete);
    //     fs.unlinkSync(certToDelete);
    // });
});
