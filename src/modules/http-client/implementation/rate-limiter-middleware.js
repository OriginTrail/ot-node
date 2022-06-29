const rateLimiter = require('express-rate-limit');

module.exports = (config) =>
    rateLimiter({
        windowMs: config.timeWindowSeconds * 1000,
        max: config.maxRequests,
        message: `Too many requests sent, maximum number of requests per minute is ${config.maxRequests}`,
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
