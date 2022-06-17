const SHA256 = require('crypto-js/sha256');
const MerkleTools = require('merkle-tools');
const sha3 = require('js-sha3');
const elliptic = require('elliptic');
const sortedStringify = require('json-stable-stringify');
// eslint-disable-next-line new-cap
const secp256k1 = new elliptic.ec('secp256k1');
const BytesUtilities = require('../bytes-utilities');

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

    calculateRootHash(assertion) {
        assertion.sort();
        const tree = new MerkleTools({
            hashType: 'sha256',
        });
        assertion.forEach((leaf, index)=>{
            const leafHash = this.calculateHash(leaf);
            tree.addLeaf(leafHash + index, true);
        });
        tree.makeTree();
        return tree.getMerkleRoot().toString('hex');
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

    sign(content, privateKey) {
        const signature = secp256k1
            .keyFromPrivate(Buffer.from(BytesUtilities.normalizeHex(privateKey).slice(2), 'hex'))
            .sign(Buffer.from(content, 'hex'), { canonical: true });

        const result = this.encodeSignature([
            BytesUtilities.fromString(BytesUtilities.fromNumber(27 + signature.recoveryParam)),
            BytesUtilities.pad(32, BytesUtilities.fromNat(`0x${signature.r.toString(16)}`)),
            BytesUtilities.pad(32, BytesUtilities.fromNat(`0x${signature.s.toString(16)}`)),
        ]);

        return result.signature;
    }

    verify(hash, signature, publicKey) {
        try {
            let vrs;
            if (
                Object.keys(signature).includes('r') &&
                Object.keys(signature).includes('s') &&
                Object.keys(signature).includes('v')
            ) {
                vrs = {
                    v: BytesUtilities.toNumber(signature.v),
                    r: signature.r.slice(2),
                    s: signature.s.slice(2),
                };
            } else {
                const decoded = this.decodeSignature(signature);

                vrs = {
                    v: BytesUtilities.toNumber(decoded[0]),
                    r: decoded[1].slice(2),
                    s: decoded[2].slice(2),
                };
            }

            const pubKeyRecovered = secp256k1.recoverPubKey(
                Buffer.from(hash, 'hex'),
                vrs,
                vrs.v < 2 ? vrs.v : 1 - (vrs.v % 2),
            );

            if (secp256k1.verify(hash, vrs, pubKeyRecovered)) {
                const publicKeyRecovered = `0x${pubKeyRecovered.encode('hex', false).slice(2)}`;
                const publicHash = sha3.keccak256(Buffer.from(publicKeyRecovered.slice(2), 'hex'));
                const wallet = this.toChecksum(`0x${publicHash.slice(-40)}`);

                return (
                    BytesUtilities.normalizeHex(wallet).toLowerCase() ===
                    BytesUtilities.normalizeHex(publicKey).toLowerCase()
                );
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    recover(content, signature) {
        try {
            let vrs;
            if (
                Object.keys(signature).includes('r') &&
                Object.keys(signature).includes('s') &&
                Object.keys(signature).includes('v')
            ) {
                vrs = {
                    v: BytesUtilities.toNumber(signature.v),
                    r: signature.r.slice(2),
                    s: signature.s.slice(2),
                };
            } else {
                const decoded = this.decodeSignature(signature);

                vrs = {
                    v: BytesUtilities.toNumber(decoded[0]),
                    r: decoded[1].slice(2),
                    s: decoded[2].slice(2),
                };
            }

            const hash = this.hashContent(content);
            const pubKeyRecovered = secp256k1.recoverPubKey(
                Buffer.from(hash.slice(2), 'hex'),
                vrs,
                vrs.v < 2 ? vrs.v : 1 - (vrs.v % 2),
            );

            const publicKeyRecovered = `0x${pubKeyRecovered.encode('hex', false).slice(2)}`;
            const publicHash = sha3.keccak256(Buffer.from(publicKeyRecovered.slice(2), 'hex'));
            return this.toChecksum(`0x${publicHash.slice(-40)}`);
        } catch (e) {
            return undefined;
        }
    }

    encodeSignature(signature) {
        const _ref2 = _slicedToArray(signature);
        const v = _ref2[0];
        const r = BytesUtilities.pad(32, _ref2[1]);
        const s = BytesUtilities.pad(32, _ref2[2]);

        return {
            signature: BytesUtilities.flatten([r, s, v]),
            r,
            s,
            v,
        };
    }

    decodeSignature(signature) {
        return [
            BytesUtilities.slice(64, BytesUtilities.length(signature), signature),
            BytesUtilities.slice(0, 32, signature),
            BytesUtilities.slice(32, 64, signature),
        ];
    }

    toChecksum(address) {
        const addressHash = sha3.keccak256(address.slice(2));
        let checksumAddress = '0x';
        for (let i = 0; i < 40; i += 1) {
            checksumAddress +=
                parseInt(addressHash[i + 2], 16) > 7
                    ? address[i + 2].toUpperCase()
                    : address[i + 2];
        }
        return checksumAddress;
    }

    hashContent(content) {
        const message = BytesUtilities.isHexStrict(content)
            ? BytesUtilities.hexToBytes(content)
            : content;
        const messageBuffer = Buffer.from(message);
        const preamble = `\x19Ethereum Signed Message:\n${message.length}`;
        const preambleBuffer = Buffer.from(preamble);
        const ethMessage = Buffer.concat([preambleBuffer, messageBuffer]);
        return `0x${sha3.keccak256(ethMessage)}`;
    }
}

module.exports = MerkleValidation;
