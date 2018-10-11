const request = require('request');

/**
 * @typedef {Object} ImportInfo
 * @property {string} data_provider_wallet Data provider wallet.
 * @property {Object} import Import object with vertices and edges.
 * @property {string} import_hash SHA3 of the import (sorted import object to JSON with padding 0).
 * @property {string} root_hash Merkle root-hash of the import (sorted import object).
 * @property {string} transaction Transaction hash of the write-fingerprint transaction.
 */

/**
 * Fetch /api/import_info?import_id=?
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} importId ID.
 * @return {Promise.<ImportInfo>}
 */
async function apiImportInfo(nodeRpcUrl, importId) {
    return new Promise((accept, reject) => {
        request(
            `${nodeRpcUrl}/api/import_info?import_id=${importId}`,
            { json: true },
            (err, res, body) => {
                if (err) {
                    reject(err);
                    return;
                }
                accept(body);
            },
        );
    });
}

exports.apiImportInfo = apiImportInfo;
