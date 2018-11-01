const sortedStringify = require('sorted-json-stringify');
const { sha3_256 } = require('js-sha3');

function calculateImportHash(data) {
    return `0x${sha3_256(sortedStringify(data, null, 0))}`;
}

module.exports = {
    calculateImportHash,
};
