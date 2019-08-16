/**
 * Methods used for various data schema validations
 */
const ethutils = require('ethereumjs-util');
const importUtilities = require('../ImportUtilities');
const Utilities = require('../Utilities');
const web3 = require('web3');
// const Buffer = require('buffer');
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
    constructor() {
        this.supportedSchemas = { '/schemas/erc725-main': SchemaValidator._validateERC725Schema };
    }

    /**
     * Validate a particular schema
     * @param document OT-JSON dataset
     * @param schemaName the name of the schema to be validated
     */
    validateSchema(document, schemaName) {
        return this.supportedSchemas[schemaName](document);
    }

    _getSignerAddress(document) {
        const merkleRoot = importUtilities.calculateDatasetRootHash(document['@graph'], document['@id'], document.datasetHeader.dataCreator);
        const { signature } = document;

        const { value } = signature;
        const normValue = Utilities.denormalizeHex(value);

        const p = {};
        p.r = `0x${normValue.slice(0, 64)}`;
        p.s = `0x${normValue.slice(64, 128)}`;
        const v = `0x${normValue.slice(128, 130)}`;
        p.v_decimal = web3.utils.hexToNumber(v);

        const key = ethutils.ecrecover(Buffer.from(Utilities.denormalizeHex(merkleRoot), 'hex'), p.v_decimal, p.r, p.s);

        const addr = key.toString('hex').slice(key.length - 40, key.length);

        return Utilities.normalizeHex(addr);
    }

    _validateERC725Schema(document) {
        const signer = this._getSignerAddress(document);


        // otjson.datasetHeader.dataIntegrity.proofs[0].proofValue = merkleRoot;

        // const signedOtjson = importUtilities.signDataset(otjson, this.config, this.web3);

        // return signedOtjson;
        // return null;
    }
}



module.exports = SchemaValidator;
