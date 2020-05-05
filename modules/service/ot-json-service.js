const ImportUtilities = require('../ImportUtilities');
const Utilities = require('../Utilities');

const supported_otjson_standards = ['1.0'];

class OtJsonService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.web3 = ctx.web3;
    }

    /**
     * Function for extracting the OT-JSON version of the dataset
     * Throws an error if the field (or a parent field) could not be found
     * @param dataset - Dataset in OT-JSON format, containing the OTJSONVersion in the datasetHeader
     * @returns {string} - Version of OT-JSON
     * @private
     */
    static _getDatasetVersion(dataset) {
        if (!dataset || !dataset.datasetHeader ||
            !dataset.datasetHeader.OTJSONVersion) {
            throw new Error('Could not determine dataset ot-json version!');
        }
        return dataset.datasetHeader.OTJSONVersion;
    }

    /**
     * Formats the dataset graph hash so that
     * @param dataset
     * @returns {} - Returns a copy of the dataset, with the graph organized for proper graph hash
     * generation
     */
    static prepareDatasetForGeneratingGraphHash(dataset) {
        const version = OtJsonService._getDatasetVersion(dataset);

        // TODO Add the sortObjectRecursively function here;
        const datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            datasetCopy['@graph'] = JSON.parse(Utilities.sortedStringify(datasetCopy['@graph']));
            break;
        default:
            throw new Error('Unsupported ot-json version!');
        }

        return datasetCopy;
    }

    static prepareDatasetForGeneratingRootHash(dataset) {
        const version = OtJsonService._getDatasetVersion(dataset);

        let datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            datasetCopy = JSON.parse(ImportUtilities.sortStringifyDataset(datasetCopy));
            break;
        default:
            throw new Error('Unsupported ot-json version!');
        }

        return datasetCopy;
    }

    static prepareDatasetForGeneratingSignature(dataset) {
        const version = OtJsonService._getDatasetVersion(dataset);

        const datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            return JSON.parse(Utilities.sortedStringify(datasetCopy));
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    static prepareDatasetForGeneratingLitigationProof(dataset) {
        const version = OtJsonService._getDatasetVersion(dataset);

        const datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            datasetCopy['@graph'] = JSON.parse(Utilities.sortedStringify(datasetCopy['@graph']));
            return datasetCopy;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    static prepareDatasetForGeneratingChallenges(dataset) {
        const version = OtJsonService._getDatasetVersion(dataset);

        const datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            datasetCopy['@graph'] = JSON.parse(Utilities.sortedStringify(datasetCopy['@graph']));
            return datasetCopy;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    static prepareDatasetForGeneratingMerkleProofs(dataset) {
        const version = OtJsonService._getDatasetVersion(dataset);

        const datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            datasetCopy['@graph'] = JSON.parse(Utilities.sortedStringify(datasetCopy['@graph']));
            return datasetCopy;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }
}

module.exports = OtJsonService;
