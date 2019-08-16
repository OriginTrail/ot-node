/**
 * Methods used for various data schema validations
 */

const importUtilities = require('../ImportUtilities');

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


class SchemaValidator {
    static supportedSchemas = [
        {
            '/schemas/erc725-main': SchemaValidator._validateERC725Schema,
        },
    ];

    /**
     * Validate a particular schema
     * @param document OT-JSON dataset
     * @param schemaName the name of the schema to be validated
     */
    static validateSchema(document, schemaName) {
        return this.supportedSchemas[schemaName](document);
    }

    static _getSignerAddress(document) {

        const merkleRoot = importUtilities.calculateDatasetRootHash(document['@graph'], document['@id'], document.datasetHeader.dataCreator);

        const signature = document.signature;

        // TODO Ecrecovery na node-u;
    }

    static _validateERC725Schema(document) {

        const signer = _getSignerAddress(document);



        otjson.datasetHeader.dataIntegrity.proofs[0].proofValue = merkleRoot;

        const signedOtjson = importUtilities.signDataset(otjson, this.config, this.web3);

        return signedOtjson;
        return null;
    }
}



module.exports = SchemaValidator;
