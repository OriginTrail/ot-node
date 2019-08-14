/**
 * Methods used for various data schema validations
 */


/**
 * Constants used to select various schemas.
 * @type {{
 * relationType: {
 *  identifies: string, hasData: string, identifiedBy: string, connectionDownstream: string},
 *  vertexType: {
 *  entityObject: string, identifier: string, data: string, connector: string},
 * edgeType: {
 *  connectorRelation: string, dataRelation: string, otRelation: string,
 *  identifierRelation: string},
 * objectType: {
 *  otConnector: string, otObject: string}}}
 */
const supportedSchemas = [
    {
        name: '/schemas/erc725-main',
        handler: '_validateERC725Schema',
    },
];

class SchemaValidator {
    /**
     * Validate a particular schema
     * @param document OT-JSON dataset
     * @param schemaName the name of the schema to be validated
     */
    static validateSchema(document, schemaName) {
        const schema = supportedSchemas.find(schema => (schema.name === schemaName));

        if (schema !== null) {
            // TODO Call schema handler
        } else {
            throw Error(`Schema ${schemaName} is not supported!`);
        }
    }

    static _validateERC725Schema() {
        return null;
    }
}

module.exports = SchemaValidator;
