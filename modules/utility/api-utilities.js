class APIUtilities {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    /**
     * Authorize request based on whitelisting
     * @param request - HTTP request
     * @return {*}
     */
    authorize(request) {
        const request_ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
        const remote_access = this.config.network.remoteWhitelist;

        if (remote_access.length > 0 && !remote_access.includes(request_ip)) {
            return {
                status: 403,
                message: 'Forbidden request',
            };
        }
        if (this.config.auth_token_enabled) {
            const token = request.query.auth_token;
            if (!token) {
                return {
                    status: 401,
                    message: 'Failed to authorize. Auth token is missing',
                };
            }
            if (token !== this.config.houston_password) {
                return {
                    status: 401,
                    message: `Failed to authorize. Auth token ${token} is invalid`,
                };
            }
        }
        return null;
    }
}

module.exports = APIUtilities;
