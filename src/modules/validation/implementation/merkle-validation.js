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

    calculateHash(assertion) {
        let stringifiedAssertion = assertion;
        if (typeof assertion !== 'string' && !(assertion instanceof String)) {
            stringifiedAssertion = sortedStringify(assertion);
        }
        const hash = SHA256(stringifiedAssertion);

        return hash.toString();
    }

    calculateRootHash(nquadsArray) {
        nquadsArray.sort();
        const leaves = nquadsArray.map((element, index) => keccak256(web3.utils.encodePacked(
            keccak256(element),
            index
        )))
        const tree = new MerkleTree(leaves, keccak256, {sortPairs: true})
        return tree.getRoot().toString('hex')
    }

    getRootHashProof(nquadsArray, challenge) {
        nquadsArray.sort();

        console.log(nquadsArray)
        const leaves = nquadsArray.map((element, index) => keccak256(web3.utils.encodePacked(
            keccak256(element),
            index
        )))
        const tree = new MerkleTree(leaves, keccak256, {sortPairs: true})

        const proof = tree.getProof(leaves[parseInt(challenge, 10)]);
        const stateCommitHash = tree.getRoot().toString('hex')

        // eslint-disable-next-line no-console
        console.log(tree.verify(proof, leaves[parseInt(challenge, 10)], stateCommitHash))


        return {leaf: leaves[parseInt(challenge, 10)], proof: proof.map(x => x.data)};
    }

    async sign(message, privateKey) {
        const result = await web3.eth.accounts.sign(message, privateKey);
        return result.signature;
    }

    async verify(message, signature, publicKey) {
        const result = await web3.eth.accounts.recover(message, signature);
        return publicKey === result;
    }

    getMerkleTree(rdf) {
        const tree = new MerkleTools({
            hashType: 'sha256',
        });
        rdf.forEach((leaf, index)=>{
            const leafHash = this.calculateHash(leaf);
            tree.addLeaf(leafHash + index, true);
        });
        tree.makeTree();
        return tree;
    }

    async getProofs(rdf, nquads) {
        rdf.sort();
        const tree = this.getMerkleTree(rdf);
        const result = [];
        for (let triple of nquads) {
            triple = triple.replace(/_:genid(.){37}/gm, '_:$1');
            const index = rdf.indexOf(triple);
            const proof = tree.getProof(index);
            result.push({ triple, tripleHash: this.calculateHash(triple), proof });
        }

        return result;
    }

    validateProof(triples, proofs, rootHash) {
        const tree = new MerkleTools();
        for (let i = 0; i < triples.length; i += 1) {
            const leaf = SHA256(triples[i]).toString();
            const verified = tree.validateProof(proofs[i], leaf, rootHash);
            if (!verified) {
                throw new Error(`Invalid proofs for triple: ${triples[i]}`);
            }
        }
        return `0x${rootHash}`;
    }
}

module.exports = MerkleValidation;
