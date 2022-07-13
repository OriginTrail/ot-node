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
     * @returns {string}
     */
    generateJWT(uuid, expiresIn) {
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
     * Decodes JWT
     * @param {string} token
     * @returns {{payload: any, signature: *, header: *}|string}
     */
    decodeJWT(token) {
        return jwt.decode(token);
    }
}

const jwtUtil = new JwtUtil();

module.exports = jwtUtil;
