const { Validator } = require('jsonschema');

const v = new Validator();

module.exports = function requestValidationMiddleware(requestSchema) {
    return (req, res, next) => {
        if (req.get('Content-Type') !== 'application/json') {
            res.status(401).send('Invalid header format');
            return;
        }

        const result = v.validate(req.body, requestSchema);
        if (result.errors.length > 0) {
            res.status(400).json({
                status: 'FAILED',
                errors: result.errors.map((e) => e.message),
            });
        } else {
            next();
        }
    };
};
