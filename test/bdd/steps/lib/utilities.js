const sortedStringify = require('sorted-json-stringify');
const { sha3_256 } = require('js-sha3');

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

module.exports = {
    calculateImportHash,
    normalizeHex,
    denormalizeHex,
};
