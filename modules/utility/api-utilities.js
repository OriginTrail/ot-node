class APIUtilities {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    /**
     * Authorize request based on whitelisting
     * @param req   HTTP request
     * @param res   HTTP response
     * @returns {boolean}
     */
    authorize(req, res) {
        const request_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const remote_access = this.config.network.remoteWhitelist;

        if (remote_access.length > 0 && !remote_access.includes(request_ip)) {
            this.logger.trace(`Client ${request_ip} not authorized`);

            res.status(403);
            res.send({
                message: 'Unauthorized request',
                data: [],
            });
            return false;
        }
        return true;
    }
}

module.exports = APIUtilities;
