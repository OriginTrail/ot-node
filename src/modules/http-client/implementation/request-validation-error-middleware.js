const { ValidationError } = require('express-json-validator-middleware');

module.exports = function validationErrorMiddleware(error, request, response, next) {
    if (response.headersSent) {
        return next(error);
    }

    const isValidationError = error instanceof ValidationError;
    if (!isValidationError) {
        return next(error);
    }

    response.status(400).json({
        status: 'FAILED',
        errors: error.validationErrors,
    });

    next();
};
