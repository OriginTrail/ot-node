// External modules
var RSA = require('node-rsa');

module.exports = function () {
    const encryption = {
        generateKeyPair() {
            var key = new RSA({ b: 512 });
			var privateKey = key.exportKey('pkcs8-private'); // eslint-disable-line
            var publicKey = key.exportKey('pkcs8-public');

            return {
                privateKey,
                publicKey,
            };
        },

        encryptObject(data, private_key) {
            var key = new RSA();
            key.importKey(private_key, 'pkcs8-private');
            var encrypted = key.encryptPrivate(data, 'base64');

            return encrypted;
        },

        decryptObject(data, public_key) {
            var key = new RSA();
            key.importKey(public_key, 'pkcs8-public');
            var decrypted = key.decryptPublic(data, 'utf8');

            return JSON.parse(decrypted);
        },
    };

    return encryption;
};
