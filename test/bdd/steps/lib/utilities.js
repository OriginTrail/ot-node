/* eslint-disable max-len */
const sortedStringify = require('sorted-json-stringify');
const { sha3_256 } = require('js-sha3');
const _ = require('lodash');
const BN = require('bn.js');
const Web3 = require('web3');

// TODO: use 3rd party.
const MerkleTree = require('../../../../modules/Merkle');

// Private functions.

function _sortedStringify(obj) {
    if (obj == null) {
        return 'null';
    }
    if (typeof obj === 'object') {
        const stringified = [];
        for (const key of Object.keys(obj)) {
            if (!Array.isArray(obj)) {
                stringified.push(`"${key}":${_sortedStringify(obj[key])}`);
            } else {
                stringified.push(_sortedStringify(obj[key]));
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
    graph.sort((e1, e2) => e1['@id'].localeCompare(e2['@id']));
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
 * Calculate dataset ID from a given graph.
 * @param graph
 * @return {string}
 */
function calculateImportHash(graph) {
    const sorted = _sortGraphRecursively(graph);
    return `0x${sha3_256(sorted, null, 0)}`;
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

function findVertexIdValue(verticesArray, vertex_type, sender_id, id_type, id_value) {
    const response = [];
    verticesArray.forEach((element) => {
        if (Object.keys(element).toString() === '_key,id_type,id_value,sender_id,vertex_type') {
            if (element.vertex_type === vertex_type && element.sender_id === sender_id && element.id_type === id_type && element.id_value === id_value) {
                response.push(element);
            }
        }
    });
    return response;
}

function findVertexUid(verticesArray, vertex_type, sender_id, uid, data) {
    const response = [];
    verticesArray.forEach((element) => {
        if (Object.keys(element).toString() === '_key,data,sender_id,uid,vertex_type') {
            if (element.vertex_type === vertex_type && element.sender_id === sender_id && element.uid === uid && _.isEqual(element.data, data)) {
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

function verifySignature(otJson, wallet) {
    const { signature } = otJson;
    const { accounts } = new Web3().eth;
    const strippedOtjson = Object.assign({}, otJson);
    delete strippedOtjson.signature;

    const stringifiedOtJson = _sortDataset(strippedOtjson);
    return (wallet.toLowerCase() === accounts.recover(stringifiedOtJson, signature.value).toLowerCase());
}

/**
 * Calculate root-hash of OT-JSON document
 * @return {string}
 * @param otJson
 */
function calculateRootHash(otJson) {
    if (otJson == null) {
        throw Error('Invalid OT JSON');
    }

    const { datasetHeader } = otJson;
    if (datasetHeader == null) {
        throw Error('Invalid OT JSON');
    }

    const graph = otJson['@graph'];

    if (!Array.isArray(graph)) {
        throw Error('Invalid graph');
    }
    if (graph.filter(v => v['@id'] == null).length > 0) {
        throw Error('Invalid graph');
    }

    const datasetSummary = _generateDatasetSummary(otJson);

    graph.forEach((el) => {
        if (el.relations) {
            el.relations.sort((r1, r2) => sha3_256(_sortedStringify(r1))
                .localeCompare(sha3_256(_sortedStringify(r2))));
        }

        if (el.identifiers) {
            el.identifiers.sort((r1, r2) => sha3_256(_sortedStringify(r1))
                .localeCompare(sha3_256(_sortedStringify(r2))));
        }
    });

    const stringifiedGraph = [];
    graph.forEach(obj => stringifiedGraph.push(_sortedStringify(obj)));

    const merkle = new MerkleTree(
        [_sortedStringify(datasetSummary), ...stringifiedGraph],
        'sha3',
    );

    return merkle.getRoot();
}

module.exports = {
    calculateImportHash,
    normalizeHex,
    denormalizeHex,
    findVertexIdValue,
    findVertexUid,
    isZeroHash,
    verifySignature,
    calculateRootHash,
};
