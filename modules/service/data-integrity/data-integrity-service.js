/**
 * Data integrity service
 */
class DataIntegrityService {
    /**
     * Creates a new instance of data integrity service
     */
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    /**
     * Sign
     */
    sign(content, privateKey) { }

    /**
    * Verify
    */
    verify(content, signature, publicKey) { }
}

module.exports = DataIntegrityService;
