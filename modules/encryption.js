var RSA = require('node-rsa');

class Encryption {

    /**
     * Returns generated 512b RSA public-private key pair
     * @returns {privateKey: string, publicKey: string}
     */
    static generateKeyPair() {
        const rsa = new RSA({ b: 512 });
        const privateKey = rsa.exportKey('pkcs8-private');
        const publicKey = rsa.exportKey('pkcs8-public');

        return {
            privateKey,
            publicKey,
        };
    }

    /**
     * Encrypts object data with given RSA private key
     * @param obj
     * @param private_key
     * @returns {*}
     */
    static encryptObject(obj, privateKey) {
        const data = JSON.stringify(obj);
        return this.encryptRawData(data, privateKey);
    }

    /**
     * Encrypts raw data with given RSA private key
     * @param data
     * @param privateKey
     * @returns {*}
     */
    static encryptRawData(data, privateKey) {
        const rsa = new RSA();
        rsa.importKey(privateKey, 'pkcs8-private');
        const encryptedData = rsa.encryptPrivate(data, 'base64');
        return encryptedData;
    }

    /**
     * Decrypts encrypted object data with given RSA public key
     * @param {string} - encryptedData
     * @param {string} - public_key
     * @returns {object}
     */
    static decryptObject(encryptedData, publicKey) {
        const decryptedData = this.decryptRawData(encryptedData, publicKey);
        return JSON.parse(decryptedData);
    }

    /**
     * Decrypts raw encrypted data with given RSA public key
     * @param {string} - encryptedData
     * @param {string} - publicKey
     * @returns {string}
     */
    static decryptRawData(encryptedData, publicKey) {
        const rsa = new RSA();
        rsa.importKey(publicKey, 'pkcs8-public');
        const decryptedData = rsa.decryptPublic(encryptedData, 'utf8');
        return decryptedData;
    }
}

module.exports = Encryption;
