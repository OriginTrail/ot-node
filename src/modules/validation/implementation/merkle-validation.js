const SHA256 = require('crypto-js/sha256');
const MerkleTools = require('merkle-tools');
const sha3 = require('js-sha3');
const elliptic = require('elliptic');
const sortedStringify = require('json-stable-stringify');
// eslint-disable-next-line new-cap
const secp256k1 = new elliptic.ec('secp256k1');
const BytesUtilities = require('../bytes-utilities');
const keccak256 = require('keccak256')
const web3 = require('web3')
const {MerkleTree} = require('merkletreejs')
const {
    calculateRoot
} = require('assertion-tools');

const _slicedToArray = (function () {
    function sliceIterator(arr, i) {
        const _arr = [];
        let _n = true;
        let _d = false;
        let _e;
        try {
            for (let _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                _arr.push(_s.value);
                if (i && _arr.length === i) break;
            }
        } catch (err) {
            _d = true;
            _e = err;
        } finally {
            try {
                if (!_n && _i.return) _i.return();
            } finally {
                if (_d) throw _e;
            }
        }
        return _arr;
    }

    return function (arr, i) {
        if (Array.isArray(arr)) {
            return arr;
        }
        if (Symbol.iterator in Object(arr)) {
            return sliceIterator(arr, i);
        }
        throw new TypeError('Invalid attempt to destructure non-iterable instance');
    };
})();

class MerkleValidation {
    async initialize(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    calculateRoot(assertion) {
        return calculateRoot(assertion);
    }

    // TODO move to assertion-tools
    getMerkleProof(nquadsArray, challenge) {
        nquadsArray.sort();

        const leaves = nquadsArray.map((element, index) => keccak256(web3.utils.encodePacked(
            keccak256(element),
            index
        )))
        const tree = new MerkleTree(leaves, keccak256, {sortPairs: true})

        const proof = tree.getProof(leaves[parseInt(challenge, 10)]);

        return {leaf: leaves[parseInt(challenge, 10)], proof: proof.map(x => x.data)};
    }
}

module.exports = MerkleValidation;
