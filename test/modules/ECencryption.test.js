const { describe, it } = require('mocha');
const { assert } = require('chai');
const encryption = require('../../modules/ECEncryption');

const myPrivateKey = '502d010352bb3ac7c81d8c0a274234eba575702131d5b9da57ac86159de7cd87';
const myPublicKey = '03b1a3cfd9e81a15065d79ec047a659e8dc580230e82dddfc67838852c2df33b02';
const testData = {
    ObjectType: 'Vegetable',
    ObjectCategory: 'Carrot',
    ObjectDescription: 'The cryptiest carrots in the entire Cryptonia, packed for retail in 1 Kg package.',
};

describe('EC Encryption modules test ', () => {
    it('Check that decrypting encrypted data gives back original data', async () => {
        const encryptedData = await encryption.encryptObject(testData, myPublicKey);
        const decryptedData = await encryption.decrypt(encryptedData, myPrivateKey);
        const decryptedObject = JSON.parse(decryptedData);

        assert.containsAllKeys(decryptedObject, ['ObjectType', 'ObjectCategory', 'ObjectDescription']);
        assert.equal(decryptedObject.ObjectCategory, testData.ObjectCategory);
        assert.equal(decryptedObject.ObjectType, testData.ObjectType);
        assert.equal(decryptedObject.ObjectDescription, testData.ObjectDescription);
    });
});
