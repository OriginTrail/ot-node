require('dotenv').config();
const jwt = require('jsonwebtoken');
const { validate } = require('uuid');

class JwtUtil {
    constructor() {
        this._secret = process.env.JWT_SECRET;
    }

    /**
     * Generates new JWT token
     * @param uuid uuid from token table
     * @param expiresIn optional parameter. accepts values for ms package (https://www.npmjs.com/package/ms)
     * @returns {string|null}
     */
    generateJWT(uuid, expiresIn = null) {
        if (!validate(uuid)) {
            return null;
        }

        const options = {
            jwtid: uuid,
        };

        if (expiresIn) {
            options.expiresIn = expiresIn;
        }

        return jwt.sign({}, this._secret, options);
    }

    /**
     * Validates JWT token
     * @param {string} token
     * @returns {boolean}
     */
    validateJWT(token) {
        try {
            jwt.verify(token, this._secret);
        } catch (e) {
            return false;
        }

        return true;
    }

    /**
     * Returns JWT payload
     * @param {string} token
     * @returns {*}
     */
    getPayload(token) {
        return jwt.decode(token);
    }

    /**
     * Decodes token
     * @param token
     * @returns {{payload: any, signature: *, header: *}|*}
     */
    decode(token) {
        return jwt.decode(token, { complete: true });
    }
}

const jwtUtil = new JwtUtil();

module.exports = jwtUtil;
