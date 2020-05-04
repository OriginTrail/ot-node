
const Utilities = require('../Utilities');
const ImportUtilities = require('../ImportUtilities');


const supported_otjson_standards = ['1.0'];

class OtJsonService {
    static _getDatasetVersion(dataset) {
        if (!dataset || !dataset.datasetHeader ||
            !dataset.datasetHeader.OTJSONVersion) {
            this.logger.warn('Could not determine dataset ot-json version!');
            throw new Error('Could not determine dataset ot-json version!');
        }
        return dataset.datasetHeader.OTJSONVersion;
    }

    static prepareDatasetForGeneratingGraphHash(dataset) {
        const version = OtJsonService._getDatasetVersion(dataset);

        // TODO Add the sortObjectRecursively function here;
        let datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            datasetCopy = JSON.parse(Utilities.sortedStringify(datasetCopy['@graph']));
            break;
        default:
            throw new Error('Unsupported ot-json version!');
        }

        return datasetCopy;
    }

    static prepareDatasetForGeneratingRootHash(dataset) {
        const version = OtJsonService._getDatasetVersion(dataset);

        const datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            ImportUtilities.sortGraphRecursively(datasetCopy);
            break;
        default:
            throw new Error('Unsupported ot-json version!');
        }

        return datasetCopy;
    }
}

module.exports = OtJsonService;
