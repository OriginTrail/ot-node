const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const NodeRSA = require('node-rsa');
const encryption = require('../../modules/encryption')();

const privateFormatId = 'pkcs8-private';
const publicFormatId = 'pkcs8-public';
const keySize = 512;

let myPrivateKey;
let myPublicKey;
let myObj;

describe('Encryption modules ', () => {
    function isMyPrivateKeyEmpty(keyData) {
        const key = new NodeRSA();
        key.importKey(keyData, privateFormatId);
        return key.isEmpty();
    }

    function isMyPublicKeyEmpty(keyData) {
        const key = new NodeRSA();
        key.importKey(keyData, publicFormatId);
        return key.isEmpty();
    }

    function getMyPrivateKeySize(keyData) {
        const key = new NodeRSA();
        key.importKey(keyData, privateFormatId);
        return key.getKeySize();
    }

    function getMyPublicKeySize(keyData) {
        const key = new NodeRSA();
        key.importKey(keyData, publicFormatId);
        return key.getKeySize();
    }


    it('generateKeyPair() should generate valid 512 b key pair', () => {
        myObj = encryption.generateKeyPair();
        myPrivateKey = myObj.privateKey;
        myPublicKey = myObj.publicKey;

        assert.isFalse(isMyPrivateKeyEmpty(myPrivateKey), 'Key should not be empty');
        assert.isFalse(isMyPublicKeyEmpty(myPublicKey), 'Key should not be empty');
        assert.equal(getMyPrivateKeySize(myPrivateKey), keySize, 'Key size should be 512');
        assert.equal(getMyPublicKeySize(myPublicKey), keySize, 'Key size should be 512');
    });

    it('check that decrypting encrypted data gives back original data', () => {
        const testData = { ObjectType: 'Vegetable', ObjectCategory: 'Carrot', ObjectDescription: 'The cryptiest carrots in the entire Cryptonia, packed for retail in 1 Kg package.' };
        const encryptedObject = encryption.encryptObject(testData, myPrivateKey);
        const decryptedObject = encryption.decryptObject(encryptedObject, myPublicKey);

        assert.containsAllKeys(decryptedObject, ['ObjectType', 'ObjectCategory', 'ObjectDescription']);
        assert.equal(decryptedObject.ObjectCategory, testData.ObjectCategory);
        assert.equal(decryptedObject.ObjectType, testData.ObjectType);
        assert.equal(decryptedObject.ObjectDescription, testData.ObjectDescription);
    });
});
