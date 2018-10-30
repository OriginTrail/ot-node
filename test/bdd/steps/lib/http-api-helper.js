const request = require('request');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} ImportInfo
 * @property {string} data_provider_wallet Data provider wallet.
 * @property {Object} import Import object with vertices and edges.
 * @property {string} import_hash SHA3 of the import (sorted import object to JSON with padding 0).
 * @property {string} root_hash Merkle root-hash of the import (sorted import object).
 * @property {string} transaction Transaction hash of the write-fingerprint transaction.
 */

/**
 * Fetch /api/import_info?import_id={{import_id}}
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param dataSetId Data-set ID
 * @return {Promise.<ImportInfo>}
 */
async function apiImportInfo(nodeRpcUrl, dataSetId) {
    return new Promise((accept, reject) => {
        request(
            `${nodeRpcUrl}/api/import_info?data_set_id=${dataSetId}`,
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

/**
 * Fetch api/fingerprint?data_set_id={{data_set_id}}
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} jsonQuery
 * @return {Promise.<FingerprintInfo>}
 */
async function apiFingerprint(nodeRpcUrl, datSetId) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/fingerprint?data_set_id=${datSetId}`,
                json: true,
            },
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

/**
 * Fetch /api/import
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} importFilePath
 * @param {string} importType
 * @return {Promise.<Import>}
 */
async function apiImport(nodeRpcUrl, importFilePath, importType) {
    return new Promise((accept, reject) => {
        request({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/import`,
            json: true,
            formData: {
                importfile: fs.createReadStream(path.join(__dirname, '../../../../', importFilePath)),
                importtype: `${importType}`,
            },
        }, (error, response, body) => {
            if (error) {
                reject(error);
                return;
            }
            accept(body);
        });
    });
}

/**
 * Fetch /api/query/local response
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {json} jsonQuery
 * @return {Promise}
 */
async function apiQueryLocal(nodeRpcUrl, jsonQuery) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/query/local`,
                json: true,
                body: jsonQuery,
            },
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

/**
 * Fetch /api/query/local/import/{{import_id}}
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} importId ID.
 * @return {Promise}
 */
async function apiQueryLocalImportByImportId(nodeRpcUrl, importId) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/query/local/import/${importId}`,
                json: true,
            },
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

/**
 * Fetch /api/query/local/import response
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {json} jsonQuery
 * @return {Promise}
 */
async function apiQueryLocalImport(nodeRpcUrl, jsonQuery) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/query/local/import`,
                json: true,
                body: jsonQuery,
            },
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

/**
 * Fetch /api/replication response
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param data_set_id Data-set ID
 * @return {Promise}
 */
async function apiReplication(nodeRpcUrl, data_set_id) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/replication`,
                json: true,
                body: {
                    data_set_id,
                },
            },
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

module.exports = {
    apiImport,
    apiImportInfo,
    apiFingerprint,
    apiQueryLocal,
    apiQueryLocalImport,
    apiQueryLocalImportByImportId,
    apiReplication,
};
