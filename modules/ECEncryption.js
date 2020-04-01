const Utilities = require('./Utilities');
const eccrypto = require('eccrypto');
const { instantiateSecp256k1 } = require('bitcoin-ts');

class ECEncryption {
    /**
     * Encrypts object data with given EC public key
     * @param obj
     * @param publicKey
     * @returns base64 encrypted data
     */
    static async encryptObject(obj, publicKey) {
        const data = JSON.stringify(Utilities.sortObject(obj));
        const encryptedData = await this.encryptRawData(data, publicKey);
        return encryptedData;
    }

    /**
     * Encrypts raw data with given EC public key
     * @param data
     * @param publicKey
     * @returns base64 encrypted data
     */
    static async encryptRawData(data, publicKey) {
        const denormalizedPublicKey = Utilities.denormalizeHex(publicKey);
        const uncompressedPublicKey = await this.uncompressPublicKey(denormalizedPublicKey);
        const encryptedData = await eccrypto.encrypt(uncompressedPublicKey, Buffer.from(data));
        return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
    }

    /**
     * Decrypts raw encrypted data with given EC private key
     * @param {string} - encryptedData
     * @param {string} - privateKey
     * @returns {string}
     */
    static async decrypt(encryptedData, privateKey) {
        const denormalizedPrivateKey = Buffer.from(Utilities.denormalizeHex(privateKey), 'hex');
        const rawData = JSON.parse(Buffer.from(encryptedData, 'base64').toString());
        // when we do json parse and stringify buffer object is translated to array,
        // and we need buffer in order to decrypt message
        rawData.iv = Buffer.from(rawData.iv.data);
        rawData.ephemPublicKey = Buffer.from(rawData.ephemPublicKey.data);
        rawData.ciphertext = Buffer.from(rawData.ciphertext.data);
        rawData.mac = Buffer.from(rawData.mac.data);
        const decryptedData = await eccrypto.decrypt(denormalizedPrivateKey, rawData);
        return decryptedData.toString();
    }

    static async uncompressPublicKey(compressedPublicKey) {
        const secp256k1 = await instantiateSecp256k1();
        const publicKeyBuffer = Buffer.from(compressedPublicKey, 'hex');
        return secp256k1.uncompressPublicKey(publicKeyBuffer);
    }
}

module.exports = ECEncryption;
