const MerkleTree = require('./Merkle');
const Graph = require('./Graph');
const Encryption = require('./Encryption');
const bytes = require('utf8-length');
const utilities = require('./Utilities');
const uuidv4 = require('uuid/v4');
const { sha3_256 } = require('js-sha3');
const { denormalizeGraph, normalizeGraph } = require('./Database/graph-converter');

const Models = require('../models');

/**
 * Import related utilities
 */
class ImportUtilities {
    /**
     * Hides _key attributes
     * @param vertices
     * @param edges
     */
    static packKeys(vertices, edges) {
        for (const vertex of vertices) {
            if (!vertex._dc_key) {
                vertex._dc_key = vertex._key;
                vertex._key = uuidv4();
            }
            vertex.encrypted = true;
        }
        // map _from and _to
        const find = (key) => {
            const filtered = vertices.filter(v => v._dc_key === key);
            if (filtered.length > 0) {
                return filtered[0]._key;
            }
            return null;
        };
        for (const edge of edges) {
            const from = find(edge._from);
            if (from) {
                edge._from = from;
            }
            const to = find(edge._to);
            if (to) {
                edge._to = to;
            }

            edge.encrypted = true;
        }
        for (const edge of edges) {
            if (!edge._dc_key) {
                edge._dc_key = edge._key;
                edge._key = uuidv4();
            }
        }
    }

    /**
     * Restores _key attributes
     * @param vertices
     * @param edges
     */
    static unpackKeys(vertices, edges) {
        const mapping = {};
        for (const vertex of vertices) {
            if (vertex._dc_key) {
                mapping[vertex._key] = vertex._dc_key;
                vertex._key = vertex._dc_key;
                delete vertex._dc_key;
            }
            delete vertex.encrypted;
        }
        for (const edge of edges) {
            if (edge._dc_key) {
                edge._key = edge._dc_key;
                delete edge._dc_key;

                if (mapping[edge._from]) {
                    edge._from = mapping[edge._from];
                }
                if (mapping[edge._to]) {
                    edge._to = mapping[edge._to];
                }
            }
            delete edge.encrypted;
        }
    }

    /**
     * Normalizes import (use just necessary data)
     * @param vertices  Import vertices
     * @param edges     Import edges
     * @returns {{edges: *, vertices: *}}
     */
    static normalizeImport(dataSetId, vertices, edges) {
        ImportUtilities.sort(edges);
        ImportUtilities.sort(vertices);

        const { vertices: normVertices, edges: normEdges } = normalizeGraph(
            dataSetId,
            vertices,
            edges,
        );

        return utilities.sortObject({
            edges: normEdges,
            vertices: normVertices,
        });
    }

    /**
     * Calculate import hash
     * @param dataSetId Data set ID
     * @param vertices  Import vertices
     * @param edges     Import edges
     * @returns {*}
     */
    static importHash(dataSetId, vertices, edges) {
        const normalized = ImportUtilities.normalizeImport(dataSetId, vertices, edges);
        return utilities.normalizeHex(sha3_256(utilities.stringify(normalized, 0)));
    }

    /**
     * Creates Merkle tree from import data
     * @param vertices  Import vertices
     * @param edges     Import edges
     * @return {Promise<{tree: MerkleTree, leaves: Array, hashPairs: Array}>}
     */
    static async merkleStructure(vertices, edges) {
        ImportUtilities.sort(edges);
        ImportUtilities.sort(vertices);

        const leaves = [];
        const hashPairs = [];

        // process vertices
        for (const i in vertices) {
            const hash = utilities.soliditySHA3(utilities.sortObject({
                identifiers: vertices[i].identifiers,
                data: vertices[i].data,
            }));
            leaves.push(hash);
            hashPairs.push({
                key: vertices[i]._key,
                hash,
            });
        }

        for (const edge of edges) {
            const hash = utilities.soliditySHA3(utilities.sortObject({
                identifiers: edge.identifiers,
                _from: edge._from,
                _to: edge._to,
                edge_type: edge.edge_type,
            }));
            leaves.push(hash);
            hashPairs.push({
                key: edge._key,
                hash,
            });
        }

        leaves.sort();
        const tree = new MerkleTree(leaves);
        return {
            tree,
            leaves,
            hashPairs,
        };
    }

    static sort(documents, key = '_key') {
        const sort = (a, b) => {
            if (a[key] < b[key]) {
                return -1;
            } else if (a[key] > b[key]) {
                return 1;
            }
            return 0;
        };
        documents.sort(sort);
    }

    static compareDocuments(documents1, documents2) {
        ImportUtilities.sort(documents1);
        ImportUtilities.sort(documents2);

        for (const index in documents1) {
            const distance = utilities.objectDistance(documents1[index], documents2[index]);
            if (distance !== 100) {
                return false;
            }
        }
        return true;
    }

    /**
     * Calculates more or less accurate size of the import
     * @param vertices   Collection of vertices
     * @returns {number} Size in bytes
     */
    static calculateEncryptedImportSize(vertices) {
        const keyPair = Encryption.generateKeyPair(); // generate random pair of keys
        Graph.encryptVertices(vertices, keyPair.privateKey);
        return bytes(JSON.stringify(vertices));
    }

    /**
     * Deletes internal vertex data
     * @param vertices
     */
    static deleteInternal(vertices) {
        for (const vertex of vertices) {
            delete vertex.datasets;
            delete vertex.private;
            delete vertex.version;
        }
    }

    /**
     * Encrypt vertices data with specified private key.
     *
     * All vertices that has data property will be encrypted with given private key.
     * @param vertices Vertices to encrypt
     * @param privateKey Encryption key
     */
    static immutableEncryptVertices(vertices, privateKey) {
        const copy = utilities.copyObject(vertices);
        for (const id in copy) {
            const vertex = copy[id];
            if (vertex.data) {
                vertex.data = Encryption.encryptObject(vertex.data, privateKey);
            }
        }
        return copy;
    }

    /**
     * Decrypts vertices with a public key
     * @param vertices      Encrypted vertices
     * @param public_key    Public key
     * @returns {*}
     */
    static immutableDecryptVertices(vertices, public_key) {
        const copy = utilities.copyObject(vertices);
        for (const id in copy) {
            if (copy[id].data) {
                copy[id].data = Encryption.decryptObject(copy[id].data, public_key);
            }
        }
        return copy;
    }

    /**
     * Filter CLASS vertices
     * @param vertices
     * @returns {*}
     */
    static immutableFilterClassVertices(vertices) {
        return vertices.filter(vertex => vertex.vertex_type !== 'CLASS');
    }

    /**
     * Gets transaction hash for the data set
     * @param dataSetId Data set ID
     * @param origin    Data set origin
     * @return {Promise<null>}
     */
    static async getTransactionHash(dataSetId, origin) {
        let transactionHash = null;

        switch (origin) {
        case 'PURCHASED': {
            const purchasedData = await Models.purchased_data.findOne({
                where: { data_set_id: dataSetId },
            });
            transactionHash = purchasedData.transaction_hash;
            break;
        }
        case 'HOLDING': {
            const holdingData = await Models.holding_data.findOne({
                where: { data_set_id: dataSetId },
            });
            transactionHash = holdingData.transaction_hash;
            break;
        }
        case 'IMPORTED': {
            // TODO support many offers for the same data set
            const offers = await Models.offers.findAll({
                where: { data_set_id: dataSetId },
            });
            if (offers.length > 0) {
                transactionHash = offers[0].transaction_hash;
            }
            break;
        }
        default:
            transactionHash = null;
        }
        return transactionHash;
    }
}

module.exports = ImportUtilities;
