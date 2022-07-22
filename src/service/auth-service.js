const ipLib = require('ip');
const jwtUtil = require('./util/jwt-util');

module.exports = class AuthService {
    constructor(ctx) {
        this._config = ctx.config.modules.authentication;
        this._repository = ctx.repositoryModuleManager;
    }

    /**
     * Authenticate users based on provided ip and token
     * @param ip
     * @param token
     * @returns {boolean}
     */
    async authenticate(ip, token) {
        const isWhitelisted = this._isIpWhitelisted(ip);
        const isTokenValid = this._isTokenValid(token);

        if (!isWhitelisted || !isTokenValid) {
            return false;
        }

        return !this._isTokenRevoked(token);
    }

    /**
     * Validates token
     * If ot-node is configured not to do a token based auth, it will return true
     * @param token
     * @returns {boolean}
     * @private
     */
    _isTokenValid(token) {
        if (!this._config.tokenBasedAuthEnabled) {
            return true;
        }

        return jwtUtil.validateJWT(token);
    }

    /**
     * Checks whether provided ip is whitelisted in config
     * Returns false if ip based auth is disabled
     * @param ip
     * @returns {boolean}
     * @private
     */
    _isIpWhitelisted(reqIp) {
        if (!this._config.ipBasedAuthEnabled) {
            return true;
        }

        for (const whitelistedIp of this._config.ipWhitelist) {
            let isEqual = false;

            try {
                isEqual = ipLib.isEqual(reqIp, whitelistedIp);
            } catch (e) {
                // if ip is not valid IP isEqual should remain false
            }

            if (isEqual) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checks whether provided token is revoked
     * Returns false if token based auth is disabled
     * @param token
     * @returns {Promise<boolean|*>|boolean}
     * @private
     */
    _isTokenRevoked(token) {
        if (!this._config.tokenBasedAuthEnabled) {
            return false;
        }

        const tokenId = jwtUtil.getPayload(token).jti;

        return this._repository.isTokenRevoked(tokenId);
    }
};
