const SchemaValidator = require('../modules/validator/schema-validator');


const file = require('./20.json');

const validator = new SchemaValidator();

validator._getSignerAddress(file);
