import { Validator } from 'jsonschema';

const v = new Validator();

function preValidateProperty(object, key, schema, options, ctx) {
    const value = object[key];
    if (typeof value === 'undefined') return;

    // Test if the schema declares a type, but the type keyword fails validation
    if (
        schema.type &&
        v.attributes.type.call(v, value, schema, options, ctx.makeChild(schema, key))
    ) {
        // If the type is "number" but the instance is not a number, cast it
        if (schema.type === 'number' && typeof value !== 'number') {
            // eslint-disable-next-line no-param-reassign
            object[key] = parseFloat(value);
        }
    }
}

export default function requestValidationMiddleware(requestSchema) {
    return (req, res, next) => {
        let result;
        if (req.method === 'GET')
            result = v.validate(req.query, requestSchema, { preValidateProperty });
        else if (req.get('Content-Type') !== 'application/json') {
            res.status(401).send('Invalid header format');
            return;
        } else result = v.validate(req.body, requestSchema);

        if (result.errors.length > 0) {
            res.status(400).json({
                status: 'FAILED',
                errors: result.errors.map((e) => e.message),
            });
        } else {
            next();
        }
    };
}
