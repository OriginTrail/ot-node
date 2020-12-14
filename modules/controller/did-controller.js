/**
 * DID related API controller
 */
class DIDController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.didService = ctx.didService;
    }

    /**
     * Resolve DID identifier
     * @returns {Promise<*>}
     */
    async resolve(req, res) {
        this.logger.api('POST: DID resolve request request received.');
        if (!req.body) {
            res.status(400);
            res.send({
                message: 'Body is missing',
            });
            return;
        }

        const { didUrl } = req.body;

        try {
            const document = await this.didService.resolve(didUrl);

            res.status(200);
            res.send({ document, status: 'COMPLETED' });
        } catch (e) {
            res.status(400);
            res.send({ message: e.message, status: 'FAILED' });
        }
    }

    /**
     * Authenticate DID identifier
     * @returns {Promise<*>}
     */
    async authenticate(req, res) {
        this.logger.api('POST: DID resolve request request received.');
        if (!req.body) {
            res.status(400);
            res.send({
                message: 'Body is missing',
            });
            return;
        }

        const { message, signature, didUrl } = req.body;

        try {
            const authenticated = await this.didService.authenticate(message, signature, didUrl);

            res.status(200);
            res.send({ authenticated });
        } catch (e) {
            res.status(400);
            res.send({ authenticated: false });
        }
    }
}

module.exports = DIDController;

