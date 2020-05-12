const Utilities = require('./Utilities');
const { sha3_256 } = require('js-sha3');

class OtJsonUtilities {
    /**
     * Used for OT-JSON version 1.0
     *
     * Function for sorting a graph by the @id parameter and every graph element's identifier and
     * relation arrays by the hash value of the array element
     * @param graph
     * @returns undefined
     */
    static sortGraphRelationsAndIdentifiers(graph) {
        graph.forEach((el) => {
            if (el.relations) {
                el.relations.sort((r1, r2) => sha3_256(Utilities.sortedStringify(r1))
                    .localeCompare(sha3_256(Utilities.sortedStringify(r2))));
            }

            if (el.identifiers) {
                el.identifiers.sort((r1, r2) => sha3_256(Utilities.sortedStringify(r1))
                    .localeCompare(sha3_256(Utilities.sortedStringify(r2))));
            }
        });
        graph.sort((e1, e2) => (Object.keys(e1['@id']).length > 0 ? e1['@id'].localeCompare(e2['@id']) : 0));
    }

    /**
     * Function for extracting the OT-JSON version of the dataset
     * Throws an error if the field (or a parent field) could not be found
     *
     * @param dataset - Dataset in OT-JSON format, containing the OTJSONVersion in the datasetHeader
     * @returns String - Version of the OT-JSON dataset
     * @private
     */
    static _getDatasetVersion(dataset) {
        if (!dataset || !dataset.datasetHeader ||
            !dataset.datasetHeader.OTJSONVersion) {
            return '1.0';
            // throw new Error('Could not determine dataset ot-json version!');
        }
        return dataset.datasetHeader.OTJSONVersion;
    }

    /**
     * Formats the dataset graph hash so that the graph hash can be calculated properly for that
     * OT-JSON version
     *
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the dataset is
     *                              already formatted
     */
    static prepareDatasetForGeneratingGraphHash(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        const datasetCopy = Utilities.copyObject(dataset);

        switch (version) {
        case '1.0':
            datasetCopy['@graph'] = JSON.parse(Utilities.sortedStringify(datasetCopy['@graph'], true));
            return datasetCopy;
        case '1.1':
            return datasetCopy;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    /**
     * Formats the dataset graph hash so that the graph Merkle root hash can be calculated properly
     * for that OT-JSON version
     *
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the dataset is
     *                              already formatted
     */
    static prepareDatasetForGeneratingRootHash(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            datasetCopy = Utilities.copyObject(dataset);
            OtJsonUtilities.sortGraphRelationsAndIdentifiers(datasetCopy['@graph']);
            return datasetCopy;
        case '1.1':
            return dataset;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    /**
     * Formats the dataset so that the signature can be generated properly
     *
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the dataset is
     *                              already formatted
     */
    static prepareDatasetForGeneratingSignature(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            datasetCopy = Utilities.copyObject(dataset);
            OtJsonUtilities.sortGraphRelationsAndIdentifiers(datasetCopy['@graph']);
            return JSON.parse(Utilities.sortedStringify(datasetCopy, false));
        case '1.1':
            return dataset;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    /**
     * Formats the dataset for proper generating of the litigation proof
     *
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the
     *                              dataset it already formatted
     */
    static prepareDatasetForGeneratingLitigationProof(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            datasetCopy = Utilities.copyObject(dataset);
            datasetCopy['@graph'] = JSON.parse(Utilities.sortedStringify(datasetCopy['@graph'], true));
            return datasetCopy;
        case '1.1':
            return dataset;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    /**
     * Formats the dataset for proper generating of offer challenges
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the
     *                              dataset it already formatted
     */
    static prepareDatasetForGeneratingChallenges(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            datasetCopy = Utilities.copyObject(dataset);
            datasetCopy['@graph'] = JSON.parse(Utilities.sortedStringify(datasetCopy['@graph'], true));
            return datasetCopy;
        case '1.1':
            return dataset;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    /**
     * Formats the dataset for proper generating of Merkle proofs for ot-objects
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the
     *                              dataset it already formatted
     */
    static prepareDatasetForGeneratingMerkleProofs(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            datasetCopy = Utilities.copyObject(dataset);
            OtJsonUtilities.sortGraphRelationsAndIdentifiers(datasetCopy['@graph']);
            return datasetCopy;
        case '1.1':
            return dataset;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    /**
     * Formats the dataset so that the dataset can be read and imported by a Data Viewer
     *
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the dataset is
     *                              already formatted
     */
    static prepareDatasetForDataRead(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            datasetCopy = Utilities.copyObject(dataset);
            OtJsonUtilities.sortGraphRelationsAndIdentifiers(datasetCopy['@graph']);
            return JSON.parse(Utilities.sortedStringify(datasetCopy, false));
        case '1.1':
            return dataset;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    /**
     * Formats the dataset so that the dataset can be imported to the graph database
     *
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the dataset is
     *                              already formatted
     */
    static prepareDatasetForImport(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            datasetCopy = Utilities.copyObject(dataset);
            OtJsonUtilities.sortGraphRelationsAndIdentifiers(datasetCopy['@graph']);
            return JSON.parse(Utilities.sortedStringify(datasetCopy, false));
        case '1.1':
            return dataset;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    /**
     * Formats the dataset so that the dataset can be exported and validated in OT-JSON format
     *
     * @param dataset
     * @returns {any}|undefined -   A formatted copy of the dataset, or undefined if the dataset is
     *                              already formatted
     */
    static prepareDatasetForExport(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            datasetCopy = Utilities.copyObject(dataset);
            OtJsonUtilities.sortGraphRelationsAndIdentifiers(datasetCopy['@graph']);
            return datasetCopy;
        case '1.1':
            return dataset;
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }

    static sortObjectRecursively(dataset) {
        const version = OtJsonUtilities._getDatasetVersion(dataset);

        let datasetCopy;

        switch (version) {
        case '1.0':
            return dataset;
        case '1.1':
            datasetCopy = Utilities.copyObject(dataset);
            return JSON.parse(Utilities.sortObjectRecursively(datasetCopy));
        default:
            throw new Error('Unsupported ot-json version!');
        }
    }
}

module.exports = OtJsonUtilities;
