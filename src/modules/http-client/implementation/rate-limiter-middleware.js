const rateLimiter = require('express-rate-limit');
const { SERVICE_API_RATE_LIMIT } = require('../../../constants/constants');

module.exports = () =>
    rateLimiter({
        windowMs: SERVICE_API_RATE_LIMIT.TIME_WINDOW_MILLS,
        max: SERVICE_API_RATE_LIMIT.MAX_NUMBER,
        message: `Too many requests sent, maximum number of requests per minute is ${SERVICE_API_RATE_LIMIT.MAX_NUMBER}`,
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
