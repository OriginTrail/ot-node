/**
 * Methods used for various data schema validations
 */

const ethutils = require('ethereumjs-util');
const ImportUtilities = require('../ImportUtilities');
const Utilities = require('../Utilities');
const web3 = require('web3');

class SchemaValidator {
    constructor(ctx) {
        this.config = ctx.config;
        this.supportedSchemas = { '/schemas/erc725-main': () => this._validateERC725Schema };
    }

    /**
     * Validate a particular schema
     * @param data
     */
    async validateSchema(data) {
        const { document, schemaName } = data;
        let selectedSchema;
        for (const schema in this.supportedSchemas) {
            if (schemaName.includes(schema)) {
                selectedSchema = this.supportedSchemas[schema];
            }
        }
        if (selectedSchema) {
            await selectedSchema(data);
        }
    }

    _getSignerAddress(document) {
        const merkleRoot = ImportUtilities.calculateDatasetRootHash(document);
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

    async _validateERC725Schema(data) {
        // TODO Add ERC725 validation
        const { document, schemaName } = data;
        const signers = ImportUtilities.extractDatasetSigners(document);

        const { datasetHeader } = document;
        const { dataCreator } = datasetHeader;
        if (dataCreator == null || dataCreator.identifiers == null) {
            throw Error('[Validation Error] Data creator is missing.');
        }

        const { identifiers } = dataCreator;
        if (!Array.isArray(identifiers) || identifiers.length === 0) {
            throw Error('[Validation Error] Unexpected format of data creator.');
        }

        // Data creator identifier must contain ERC725 and the proper schema
        const ERCIdentifier = identifiers.find(identifierObject => (
            identifierObject.identifierType === 'ERC725'
            && identifierObject.validationSchemas === schemaName
        ));

        if (ERCIdentifier == null || typeof ERCIdentifier !== 'object' ||
            !ERCIdentifier.validationSchema.includes('/schemas/erc725-main') ||
            !Utilities.isHexStrict(ERCIdentifier.identifierValue)) {
            throw Error('[Validation Error] Wrong format of data creator.');
        }

        return null;
    }
}

module.exports = SchemaValidator;
