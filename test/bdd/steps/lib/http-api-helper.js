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
 * Fetch /api/import_info?data_set_id={{data_set_id}}
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param dataSetId Data-set ID
 * @return {Promise.<ImportInfo>}
 */
async function apiImportInfo(nodeRpcUrl, dataSetId) {
    return new Promise((accept, reject) => {
        request(
            `${nodeRpcUrl}/api/latest/import_info?data_set_id=${dataSetId}`,
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
 * @typedef {Object} FingerprintInfo
 * @property {string} root_hash Merkle root-hash of the import (sorted import object).
 */

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
                uri: `${nodeRpcUrl}/api/latest/fingerprint/${datSetId}`,
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
 * @typedef {Object} Import
 * @property {string} data_set_id Data-set ID.
 * @property {string} message Message about successful import.
 * @property {string} wallet Data provider wallet.
 */

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
            url: `${nodeRpcUrl}/api/latest/import`,
            json: true,
            formData: {
                file: fs.createReadStream(path.join(__dirname, '../../../../', importFilePath)),
                standard_id: `${importType}`,
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
 * Fetch /api/latest/import/result
 * @typedef {Object} ImportResult
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} handler_id
 * @return {Promise.<ImportResult>}
 */
async function apiImportResult(nodeRpcUrl, handler_id) {
    return new Promise((accept, reject) => {
        request({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/latest/import/result/${handler_id}`,
            json: true,
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
 * Fetch /api/export
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} dataset_id ID of dataset to be exported
 * @param {string} exportType - Export data format
 * @return {Promise.<ExportHandler>}
 */
async function apiExport(nodeRpcUrl, dataset_id, exportType) {
    return new Promise((accept, reject) => {
        request({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/latest/export`,
            json: true,
            formData: {
                dataset_id,
                standard_id: exportType,
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
 * Fetch /api/latest/export/result
 * @typedef {Object} ExportResult
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} handler_id
 * @return {Promise.<ExportResult>}
 */
async function apiExportResult(nodeRpcUrl, handler_id) {
    return new Promise((accept, reject) => {
        request({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/latest/export/result/${handler_id}`,
            json: true,
        }, (error, response, body) => {
            if (error) {
                reject(error);
                return;
            }
            accept(body);
        });
    });
}


async function apiGetDatasetInfo(nodeRpcUrl, dataset_id) {
    return new Promise((accept, reject) => {
        request({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/latest/get_dataset_info/${dataset_id}`,
            json: true,
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
 * Fetch /api/latest/import/result
 * @typedef {Object} ImportResult
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} handler_id
 * @return {Promise.<ImportResult>}
 */
async function apiReplicationResult(nodeRpcUrl, handler_id) {
    return new Promise((accept, reject) => {
        request({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/latest/replicate/result/${handler_id}`,
            json: true,
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
 * Fetch /api/latest/get_element_issuer_identity
 * @param nodeRpcUrl nodeRpcUrl URL in following format http://host:port
 * @param elementId
 * @returns {Promise}
 */
async function apiGetElementIssuerIdentity(nodeRpcUrl, elementId) {
    return new Promise((accept, reject) => {
        request({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/latest/get_element_issuer_identity/${elementId}`,
            json: true,
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
 * @typedef {Object} Import
 * @property {string} data_set_id Data-set ID.
 * @property {string} message Message about successful import.
 * @property {string} wallet Data provider wallet.
 */

/**
 * Fetch /api/import
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} content
 * @param {string} importType
 * @return {Promise.<Import>}
 */
async function apiImportContent(nodeRpcUrl, content = '', importType = 'GS1') {
    return new Promise((accept, reject) => {
        request({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/import`,
            json: true,
            formData: {
                importfile: content,
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
 * @typedef {Object} ImportsInfo
 * @property {string} data_set_id Data-set ID.
 * @property {Number} total_documents Number of documents in inport.
 * @property {string} root_hash Merkle root-hash of the import (sorted import object).
 * @property {Number} data_size Size in bytes of whole import.
 * @property {string} transaction_hash Transaction hash of the write-fingerprint transaction.
 * @property {string} data_provider_wallet Wallet of initial data provider.
 */

/**
 * Fetch /api/imports_info
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @return {Promise.<[ImportsInfo]>}
 */
async function apiImportsInfo(nodeRpcUrl) {
    return new Promise((accept, reject) => {
        request({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/latest/imports_info`,
            json: true,
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
 * @return {Promise.<[string]>}
 */
async function apiQueryLocal(nodeRpcUrl, jsonQuery) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/latest/query/local`,
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
 * @typedef {Object} QueryLocalImportByDataSetId
 * @property {Array} edges arango edges
 * @property {Array} vertices arango vertices
 */

/**
 * Fetch /api/query/local/import/{{data_set_id}}
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} dataSetId ID.
 * @return {Promise.<QueryLocalImportByDataSetId>}
 */
async function apiQueryLocalImportByDataSetId(nodeRpcUrl, dataSetId) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/latest/query/local/import/${dataSetId}`,
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
 * @typedef {Object} Replication
 * @property {string} data_set_id Data-set ID.
 * @property {string} replication_id Replication ID.
 */

/**
 * Fetch /api/replication response
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param data_set_id Data-set ID
 * @return {Promise.<Replication>}
 */
async function apiReplication(nodeRpcUrl, data_set_id) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/latest/replicate`,
                json: true,
                body: {
                    dataset_id: data_set_id,
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

/**
 * @typedef {Object} NetworkQueryId
 * @property {string} message Human informative message about query status.
 * @property {string} query_id Network query ID.
 */

/**
 * Fetch api/query/network response
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {json} jsonQuery
 * @return {Promise.<NetworkQueryId>}
 */
async function apiQueryNetwork(nodeRpcUrl, jsonQuery) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                uri: `${nodeRpcUrl}/api/latest/network/query`,
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
 * Fetch api/query/read_export response
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {json} jsonQuery
 * @return {Promise.<NetworkQueryId>}
 */
async function apiQueryNetworkReadAndExport(nodeRpcUrl, body) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/latest/network/read_export`,
                json: true,
                body,
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
 * Fetch api/query/read_export/result response
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {json} jsonQuery
 * @return {Promise.<NetworkQueryId>}
 */
async function apiQueryNetworkReadAndExportResult(nodeRpcUrl, handler_id) {
    return new Promise((accept, reject) => {
        request({
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            url: `${nodeRpcUrl}/api/latest/network/read_export/result${handler_id}`,
            json: true,
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
 * Fetch api/query/{{query_id}}/responses response
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} queryNetworkId
 * @return {Promise}
 */
async function apiQueryNetworkResponses(nodeRpcUrl, queryNetworkId) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'GET',
                uri: `${nodeRpcUrl}/api/latest/network/query/responses/${queryNetworkId}`,
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
 * @typedef {Object} ReadNetwork
 * @property {string} message A human readable message of outcome.
 */

/**
 * Fetch api/read/network
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param queryId ID of the network query.
 * @param replyId ID of the reply of the network query.
 * @param dataSetId ID of the data-set that's purchasing.
 * @return {Promise.<ReadNetwork>}
 */
async function apiReadNetwork(nodeRpcUrl, queryId, replyId, dataSetId) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                uri: `${nodeRpcUrl}/api/latest/network/read`,
                json: true,
                body: {
                    query_id: queryId,
                    reply_id: replyId,
                    data_set_id: dataSetId,
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

/**
 * @typedef {Object} ConsensusResponse
 * @property {Object} events an array of events with side1 and/or side2 objects.
 */

/**
 * Fetch /api/apiConsensus/{{sender_id}}
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {string} senderId ID of the sender, i.e. "urn:ot:object:actor:id:Company_Green"
 * @return {Promise.<ConsensusResponse>}
 */
async function apiConsensus(nodeRpcUrl, senderId) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/consensus/${senderId}`,
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
 * @typedef {Object} WhitelistResponse
 * @property {Object} .
 */

/**
 * Post /api/apiWhitelistViewer
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * TODO Write documentation for this route
 * @return {Promise.<WhitelistResponse>}
 */
async function apiWhitelistViewer(nodeRpcUrl, params) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                body: {
                    dataset_id: params.dataset_id,
                    ot_object_id: params.ot_object_id,
                    viewer_erc_id: params.viewer_erc_id,
                },
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/latest/permissioned_data/whitelist_viewer`,
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
 * @typedef {Object} TrailResponse
 * @property {Object} Graph that contains trails from a specified start batch.
 */

/**
 * Fetch /api/latest/trail/
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {object} query Query to be searched for starting vertex
 * @return {Promise.<TrailResponse>}
 */
async function apiTrail(nodeRpcUrl, params) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                body: params,
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/latest/trail`,
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
 * Fetch /api/latest/get_merkle_proofs/
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {object} params datasetId and object_ids
 * @return {Promise.<TrailResponse>}
 */
async function apiMerkleProofs(nodeRpcUrl, params) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'POST',
                body: {
                    dataset_id: params.dataset_id,
                    object_ids: params.object_ids,
                },
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/latest/get_merkle_proofs`,
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
 * @typedef {Object} InfoResponse
 * @property {Object} Node information
 */

/**
 * Fetch /api/info/ information
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @return {Promise.<InfoResponse>}
 */
async function apiNodeInfo(nodeRpcUrl) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/info`,
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
 * @typedef {Object} ApiBalanceInfo
 * @property {Object} profile info about profile balance
 * @property {string} profile.minimalStake minimal stake
 * @property {string} profile.reserved reserved
 * @property {string} profile.staked staked
 * @property {Object} wallet info about wallet balance
 * @property {string} wallet.address node's wallet address
 * @property {string} wallet.ethBalance wallet balance in ethers
 * @property {string} wallet.tokenBalance wallet balance in tokens
 */

/**
 * Fetch api/balance?humanReadable={{humanReadable}}
 *
 * @param {string} nodeRpcUrl URL in following format http://host:port
 * @param {boolean} humanReadable friendly format of response
 * @return {Promise.<ApiBalanceInfo>}
 */
async function apiBalance(nodeRpcUrl, humanReadable) {
    return new Promise((accept, reject) => {
        request(
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                uri: `${nodeRpcUrl}/api/latest/balance?humanReadable=${humanReadable}`,
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

module.exports = {
    apiImport,
    apiImportContent,
    apiImportResult,
    apiImportInfo,
    apiImportsInfo,
    apiExport,
    apiExportResult,
    apiFingerprint,
    apiQueryLocal,
    apiQueryLocalImportByDataSetId,
    apiReplication,
    apiReplicationResult,
    apiQueryNetwork,
    apiQueryNetworkResponses,
    apiReadNetwork,
    apiConsensus,
    apiTrail,
    apiMerkleProofs,
    apiNodeInfo,
    apiBalance,
    apiGetElementIssuerIdentity,
    apiGetDatasetInfo,
    apiQueryNetworkReadAndExport,
    apiWhitelistViewer,
};
