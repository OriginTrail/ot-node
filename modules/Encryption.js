var RSA = require('node-rsa');

class Encryption {
    /**
     * Returns generated 512b RSA public-private key pair
     * @param Key bit size (optional)
     * @returns {privateKey: string, publicKey: string}
     */
    static generateKeyPair(bitSize = 512) {
        const rsa = new RSA({ b: bitSize });
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

    /**
     * Pads public decryption key with random bytes up to the size of 100 Kb
     * @param {string} - publicKey
     * @returns {string} - Hex string
     */
    static padKey(publicKey) {

        publicKey = publicKey.substring(27, 160)
        const randomBlock = crypto.randomBytes(1280);
        console.log();

        const keyBuffer = Buffer.from(publicKey);

        let paddedKey = Buffer.from(randomBlock.toString('hex'), 'hex');

        for (let i = 0; i <= 16; i++) {
            for (let j = 0; j < 8; j++) {
                paddedKey[i * 80 + j] = keyBuffer[i * 8 + j];
            }
        }

        return paddedKey.toString('hex');
    }

    /**
     *
     * @param {string} - paddedKey
     * @returns {string} - Unpadded public key
     */
    static unpadKey(paddedKey) {
        let unpaddedKey = Buffer.alloc(128, 0);

        let paddedKeyBuffer = Buffer.from(paddedKey, 'hex');

        for (let i = 0; i <= 16; i++) {
            for (let j = 0; j < 8; j++) {
                unpaddedKey[i * 8 + j] = paddedKeyBuffer[i * 80 + j];
            }
        }

        const prefix = '-----BEGIN PUBLIC KEY-----\n';
        const suffix = '=\n-----END PUBLIC KEY-----';
        return prefix + unpaddedKey.toString('ascii') + suffix;
    }

    /**
     * System wide encryption
     * @param data
     * @returns {string}
     */
    static globalEncrypt(data) {
        const globalEncryptionKey = '-----BEGIN PRIVATE KEY-----\n' +
            'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCDPdDlrNVia2X/\n' +
            'maxGGcaoUkP+3VDYvENeEcIZxAaCLfuh1eJuevUCccIiFNEZP1SyGlJ0uXpw2Nwl\n' +
            '6Mnbx5/Mlygj0bI9wLkcNurVPMGpQQcgGi1JAGXXHMYcOBMW9CEGlRjTsmdnEpiV\n' +
            'ch2arc1hgw6X78MWsVe4L0NXIrg6JIKWd62Ni05WK19sr/I6rCUxBB2DVpYI0Kef\n' +
            'hZGUUHl0gXgmqM4ezJugIOgUjP2pgrNSEZXt8GdfygPEXCNe7UBGSok8p81RScdH\n' +
            'TR1jXXTrlOaIjN48l8lcqA1J5Bev9nNAUPh523L9OQuvj9jQjHMVvmvv9LRuk9Ag\n' +
            'WJTBoSJtAgMBAAECggEADIzNvBjR8u5oO4/7bFyspY3wWJ/bSk5+drFmCUa4hJxX\n' +
            'Eru8QmpZoZk1QkMRV8O5mqpvth/CeKYULz/ahbzKKCtQOFSmIcebK/qIbEm6DzBb\n' +
            'uRMnv3JdSrvCqhImqSxBODrru9q0jqO1mZzm/dKe8DMzIw5XboUY6VEDtIJqcYzF\n' +
            'v+mUYGzyX0lTSMnU4r+Ce+pO/jDk0OwC8q9e6OiTtCMKDMkjC35LspmokIkclnCs\n' +
            '8Nx9lnP0cqkgRKN46ZUY2dZIZEwQwzmQygra1rFXJel7wwbqQw9DaRhEn098a0rb\n' +
            'arT6jiOCNDZiGsCirjMqnD0LNKO7PZkk5IEia8PJ1QKBgQDzoXMnEbvMNEY89AxD\n' +
            '0XgbbDgo2cymyStpxCtNdzrN8NlyCAPS1k3qDvV1Q3zCcApvXMVRgsTbb/PKJjsJ\n' +
            'nd02tZrt+2xqTblsm7XvRrvueGg/un014dDzojJCJjMn9noV02WKNrP9fLPsy6XF\n' +
            'mLIbzi4lSGSPb/W4nHl1ThcuWwKBgQCJ55sVILRPrKvM419vpLQ2ZjL6+TLiokMB\n' +
            'Xz2bUIjMSWqUXNmFKc2wBOFNEHlfETkOgYO4wjJpzYqI9LLeJ0QkkakvEDHTYJqw\n' +
            'OU9U78/6FTI4aQ4X9G3D3N42/2m0/i6upp97Xrl60uNjD8F+k2bJhHFLXXc7SN14\n' +
            'Ixl1R2nc1wKBgHyKxfDs8dGbz2QNZc+tXva1xaesXx/LqrOwompBTwBD5QST8FBx\n' +
            'WPcTmorNaxOCbvMqu3vFm5iJjFiEXp2144W6JG8PngZhoS5SExk0UZHAX5pkXOmU\n' +
            'fFpvSb3jBTeimhpaLIgRGsW0X83m9OEkA7iPF6vba/yfQT+UTcqXluYNAoGAOPLk\n' +
            'ID15OM3dxKbA6qHhqfVaaDowwVawxQhHsLP5SiOnV81gJpW001OwltqOxKugHFVv\n' +
            'yASqPPcclqI2m3crtM5SR5UwflIOj2ebU0AVavkF3DXGFC5khdXYDm47gPrW3FkC\n' +
            '0zey8P3V2TrQdSz57Y48Gxtl+Z2Fl+8mvD/Zf9ECgYBzOaR3OJRqF97tvkhpfxri\n' +
            'DtObgk5u0FeDCI/c7fTyQAAs3KDklx/OWVJHCr/mOMnq4mc1nNEWTiT+YSc01ueI\n' +
            'uO2mYx6Lj/sGHoquOXSo0WiNqxV2dp6qPJyoVzV2V0Kj1yY5oqd1cSRXUNfRjVN4\n' +
            'NNaF8RC/7v25tRFoyCN2gQ==\n' +
            '-----END PRIVATE KEY-----';

        return this.encryptRawData(data, globalEncryptionKey);
    }

    /**
     * System wide decryption
     * @param encryptedData
     * @returns {string}
     */
    static globalDecrypt(encryptedData) {
        const globalDecryptionKey = '-----BEGIN PUBLIC KEY-----\n' +
            'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAgz3Q5azVYmtl/5msRhnG\n' +
            'qFJD/t1Q2LxDXhHCGcQGgi37odXibnr1AnHCIhTRGT9UshpSdLl6cNjcJejJ28ef\n' +
            'zJcoI9GyPcC5HDbq1TzBqUEHIBotSQBl1xzGHDgTFvQhBpUY07JnZxKYlXIdmq3N\n' +
            'YYMOl+/DFrFXuC9DVyK4OiSClnetjYtOVitfbK/yOqwlMQQdg1aWCNCnn4WRlFB5\n' +
            'dIF4JqjOHsyboCDoFIz9qYKzUhGV7fBnX8oDxFwjXu1ARkqJPKfNUUnHR00dY110\n' +
            '65TmiIzePJfJXKgNSeQXr/ZzQFD4edty/TkLr4/Y0IxzFb5r7/S0bpPQIFiUwaEi\n' +
            'bQIDAQAB\n' +
            '-----END PUBLIC KEY-----';

        return this.decryptRawData(encryptedData, globalDecryptionKey);
    }

    /**
     * Packing public key into Encrypted Padded Key
     * @param publicKey
     * @returns {string}
     */
    static packEPK(publicKey) {
        const paddedKey = this.padKey(publicKey);
        return this.globalEncrypt(paddedKey);
    }

    /**
     * Unpacking public key from Encrypted Padded Key
     * @param EPK
     * @returns {string}
     */
    static unpackEPK(EPK) {
        const paddedKey = this.globalDecrypt(EPK);
        return this.unpadKey(paddedKey);
    }

    /**
     * Calculates checksum of single 128 bit block (32 character hex string)
     * @param block
     * @param blockNumber
     * @param offset
     * @returns {*}
     */
    static calculateBlockChecksum(block, blockNumber, offset = 0) {

        if(block.length != 32) {
            return -1;
        }

        const blockHex = Buffer.from(block).toString('hex');
        const red = BN.red((new BN(2)).pow(new BN(64)));
        const g = (new BN(11)).toRed(red);
        const bi = g.redPow((new BN(blockHex).mul(new BN(blockNumber + offset))));
        const blockChecksum = Utilities.sha3(bi);

        return (new BN(blockChecksum.substring(2)).toRed(red).toString('hex'));
    }

    /**
     * Calculates sum of block checksums of hex data string
     * @param data
     * @param offset
     * @returns {*}
     */
    static calculateDataChecksum(data, offset = 0) {

        if (data.length % 32 != 0) {
            return -1;
        }

        let i = 0;
        let blockNum = 0;

        const red = BN.red((new BN(2)).pow(new BN(64)));
        let checksum = (new BN(0)).toRed(red);

        while (i < data.length) {
            let dataBlock = data.substring(i, i+32);
            let blockChecksum = this.calculateBlockChecksum(dataBlock, blockNum, offset);
            checksum = checksum.redAdd((new BN(blockChecksum, 'hex')).toRed(red));

            i += 32;
            blockNum += 1;
        }

        return checksum.toString('hex');
    }

}

module.exports = Encryption;
