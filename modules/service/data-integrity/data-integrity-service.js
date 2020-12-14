/**
 * Data integrity service
 */
class DataIntegrityService {
    /**
     * Sign
     */
    sign(content, privateKey) { }

    /**
     * Verify
     */
    verify(content, signature, publicKey) { }

    /**
     * Recover
     */
    recover(content, signature) { }
}

module.exports = DataIntegrityService;
