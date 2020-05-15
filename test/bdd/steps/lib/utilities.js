/* eslint-disable max-len */
const sortedStringify = require('sorted-json-stringify');
const { sha3_256 } = require('js-sha3');
const _ = require('lodash');
const BN = require('bn.js');
const Web3 = require('web3');
const fs = require('fs');

// TODO: use 3rd party.
const MerkleTree = require('../../../../modules/Merkle');

// Private functions.

function _sortedStringify(obj, sortArrays = false) {
    if (obj == null) {
        return 'null';
    }
    if (typeof obj === 'object') {
        const stringified = [];
        for (const key of Object.keys(obj)) {
            if (!Array.isArray(obj)) {
                stringified.push(`"${key}":${_sortedStringify(obj[key], sortArrays)}`);
            } else {
                stringified.push(_sortedStringify(obj[key], sortArrays));
            }
            if (sortArrays) {
                stringified.sort();
            }
        }
        if (!Array.isArray(obj)) {
            stringified.sort();
            return `{${stringified.join(',')}}`;
        }
        return `[${stringified.join(',')}]`;
    }
    return JSON.stringify(obj);
}

/**
 *
 * @param graph
 * @return {string|*|undefined}
 * @private
 */
function _sortGraphRecursively(graph) {
    graph.forEach((el) => {
        if (el.relations) {
            el.relations.sort((r1, r2) =>
                sha3_256(_sortedStringify(r1)).localeCompare(sha3_256(_sortedStringify(r2))));
        }

        if (el.identifiers) {
            el.identifiers.sort((r1, r2) =>
                sha3_256(_sortedStringify(r1)).localeCompare(sha3_256(_sortedStringify(r2))));
        }
    });
    graph.sort((e1, e2) => (Object.keys(e1['@id']).length > 0 ? e1['@id'].localeCompare(e2['@id']) : 0));
    return _sortedStringify(graph);
}

function _sortDataset(dataset) {
    dataset['@graph'].forEach((el) => {
        if (el.relations) {
            el.relations.sort((r1, r2) => sha3_256(_sortedStringify(r1))
                .localeCompare(sha3_256(_sortedStringify(r2))));
        }

        if (el.identifiers) {
            el.identifiers.sort((r1, r2) => sha3_256(_sortedStringify(r1))
                .localeCompare(sha3_256(_sortedStringify(r2))));
        }
    });
    dataset['@graph'].sort((e1, e2) => e1['@id'].localeCompare(e2['@id']));
    return _sortedStringify(dataset);
}

function _generateDatasetSummary(dataset) {
    return {
        datasetId: dataset['@id'],
        datasetCreator: dataset.datasetHeader.dataCreator,
        objects: dataset['@graph'].map(vertex => ({
            '@id': vertex['@id'],
            identifiers: vertex.identifiers != null ? vertex.identifiers : [],
        })),
        numRelations: dataset['@graph']
            .filter(vertex => vertex.relations != null)
            .reduce((acc, value) => acc + value.relations.length, 0),
    };
}

// Public functions.

/**
 * Function to encode file data to base64 encoded string
 * @param file
 * @return {string}
 * @private
 */
function base64Encode(file) {
    // read binary data
    const bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return Buffer.from(bitmap).toString('base64');
}


/**
 * Normalizes hex number
 * @param number     Hex number
 * @returns {string} Normalized hex number
 */
function normalizeHex(number) {
    number = number.toLowerCase();
    if (!number.startsWith('0x')) {
        return `0x${number}`;
    }
    return number;
}

/**
 * Denormalizes hex number
 * @param number     Hex number
 * @returns {string|null} Normalized hex number
 */
function denormalizeHex(number) {
    number = number.toLowerCase();
    if (number.startsWith('0x')) {
        return number.substring(2);
    }
    return number;
}

function findVertexIdValue(verticesArray, id_type, id_value) {
    const response = [];
    verticesArray.forEach((element) => {
        if (Object.keys(element).toString() === '@id,@type,identifiers,properties,relations') {
            if (element.identifiers[0]['@type'] === id_type && element.identifiers[0]['@value'] === id_value) {
                response.push(element);
            }
        }
    });
    return response;
}

function findVertexUid(verticesArray, uid) {
    const response = [];
    verticesArray.forEach((element) => {
        if (Object.keys(element).toString() === '@id,@type,identifiers,properties,relations') {
            if (element['@id'] === uid) {
                response.push(element);
            }
        }
    });
    return response;
}

/**
     * Checks if hash is zero or any given hex string regardless of prefix 0x
     * @param {string} hash
     */
function isZeroHash(hash) {
    const num = new BN(this.denormalizeHex(hash));
    return num.eqn(0);
}


/**
 * Is leaf node in the original JSON document
 * @param object - Original JSON document
 * @return {boolean}
 * @private
 */
function _isLeaf(object) {
    return object._text != null;
}

/**
 * Remove comments from raw json
 */
function _removeCommentsAndTrimTexts(obj) {
    if (typeof obj === 'object' || Array.isArray((obj))) {
        if (_isLeaf(obj)) {
            obj._text = obj._text.trim();
        }
        if (obj._comment) {
            delete obj._comment;
        }
        for (const key of Object.keys(obj)) {
            obj[key] = _removeCommentsAndTrimTexts(obj[key]);
        }
    }
    Object.keys(obj).forEach(k => (obj[k] === undefined ? delete obj[k] : '')); // remove undefined
    return obj;
}

/**
 * Creates a strings from a json derived from an xml file and removes its comments
 * @param obj
 * @returns {string}
 */
function stringifyWithoutComments(obj) {
    const object = _removeCommentsAndTrimTexts(obj);
    return _sortedStringify(object, true);
}

module.exports = {
    normalizeHex,
    denormalizeHex,
    findVertexIdValue,
    findVertexUid,
    isZeroHash,
    base64_encode: base64Encode,
    stringifyWithoutComments,
};
