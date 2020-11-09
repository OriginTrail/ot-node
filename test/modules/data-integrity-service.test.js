const { describe, before, it } = require('mocha');
const { assert, expect } = require('chai');
const DataIntegrityResolver = require('../../modules/service/data-integrity/data-integrity-resolver');

const signingWallet = {
    wallet: '0x324b939670d154667466b17524d9136d879CDC09',
    privateKey: '1556ba8faf6c2a1e696e4a70a0b7e1c6582ba26b9d8e6a9a7b96b22a29a5d2d3',
};

const message = 'message for signing';

describe('Data integrity service', () => {
    const dataIntegrityService = DataIntegrityResolver.getInstance().resolve();

    it('Sign dataset using encoded signature', () => {
        const signature = dataIntegrityService.sign(
            message,
            signingWallet.privateKey,
        );

        const wallet = dataIntegrityService.recover(message, signature.signature);
        assert.equal(wallet.toLowerCase(), signingWallet.wallet.toLowerCase());

        const valid = dataIntegrityService.verify(message, signature, wallet);
        assert.equal(valid, true);
    });


    it('Sign dataset using decoded signature', () => {
        const signature = dataIntegrityService.sign(
            message,
            signingWallet.privateKey,
        );

        delete signature.signature;

        const wallet = dataIntegrityService.recover(message, signature);
        assert.equal(wallet.toLowerCase(), signingWallet.wallet.toLowerCase());

        const valid = dataIntegrityService.verify(message, signature, wallet);
        assert.equal(valid, true);
    });
});
