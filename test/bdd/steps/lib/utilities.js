/* eslint-disable max-len */
const sortedStringify = require('sorted-json-stringify');
const { sha3_256 } = require('js-sha3');
const _ = require('lodash');


function calculateImportHash(data) {
    return `0x${sha3_256(sortedStringify(data, null, 0))}`;
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


module.exports = {
    calculateImportHash,
    normalizeHex,
    denormalizeHex,
    findVertexIdValue,
    findVertexUid,
};
