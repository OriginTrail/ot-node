// eslint-disable-next-line import/no-extraneous-dependencies
const elliptic = require('elliptic');

// eslint-disable-next-line new-cap
const secp256k1 = new elliptic.ec('secp256k1');
const sha3 = require('js-sha3');

const DataIntegrityService = require('./data-integrity-service');
const BytesUtilities = require('../../BytesUtilities');

// eslint-disable-next-line no-cond-assign,func-names,no-unsafe-finally,no-undef-init,no-undef
const _slicedToArray = (function () { function sliceIterator(arr, i) { const _arr = []; let _n = true; let _d = false; let _e = undefined; try { for (let _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i.return) _i.return(); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } throw new TypeError('Invalid attempt to destructure non-iterable instance'); }; }());

const SIGNATURE_TYPE = 'ethereum-signature';

class EllipticDataIntegrityService extends DataIntegrityService {
    sign(content, privateKey) {
        super.sign(content, privateKey);

        const keyPair = secp256k1.keyFromPrivate(BytesUtilities.normalizeHex(privateKey));
        const privKey = keyPair.getPrivate('hex');

        const hash = sha3.keccak256(content);
        const signature = secp256k1.sign(hash, privKey, 'hex', { canonical: true });

        const result = this.encodeSignature([
            BytesUtilities.fromString(BytesUtilities.fromNumber(27 + signature.recoveryParam)),
            BytesUtilities.pad(32, BytesUtilities.fromNat(`0x${signature.r.toString(16)}`)),
            BytesUtilities.pad(32, BytesUtilities.fromNat(`0x${signature.s.toString(16)}`)),
        ]);

        return { ...result, ...{ type: SIGNATURE_TYPE } };
    }

    verify(content, signature, publicKey) {
        super.verify(content, signature);

        let vrs;
        if (Object.keys(signature).includes('r') &&
            Object.keys(signature).includes('s') &&
            Object.keys(signature).includes('v')) {
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

        const hash = sha3.keccak256(content);
        const pubKeyRecovered = secp256k1.recoverPubKey(
            Buffer.from(hash, 'hex'),
            vrs,
            vrs.v < 2 ? vrs.v : 1 - (vrs.v % 2),
        );

        if (secp256k1.verify(hash, vrs, pubKeyRecovered)) {
            const publicHash = sha3.keccak256(`0x${pubKeyRecovered.encode('hex', false).slice(2)}`);
            const wallet = this.toChecksum(`0x${publicHash.slice(-40)}`);

            return BytesUtilities.normalizeHex(wallet).toLowerCase()
                === BytesUtilities.normalizeHex(publicKey).toLowerCase();
        }

        return false;
    }

    recover(content, signature) {
        super.recover(content, signature);

        let vrs;
        if (Object.keys(signature).includes('r') &&
            Object.keys(signature).includes('s') &&
            Object.keys(signature).includes('v')) {
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

        const hash = sha3.keccak256(content);
        const pubKeyRecovered = secp256k1.recoverPubKey(
            Buffer.from(hash, 'hex'),
            vrs,
            vrs.v < 2 ? vrs.v : 1 - (vrs.v % 2),
        );

        const publicHash = sha3.keccak256(`0x${pubKeyRecovered.encode('hex', false).slice(2)}`);
        return this.toChecksum(`0x${publicHash.slice(-40)}`);
    }

    encodeSignature(_ref) {
        const _ref2 = _slicedToArray(_ref);
        const v = _ref2[0];
        const r = BytesUtilities.pad(32, _ref2[1]);
        const s = BytesUtilities.pad(32, _ref2[2]);

        return {
            signature: BytesUtilities.flatten([r, s, v]), r, s, v,
        };
    }

    decodeSignature(hex) {
        return [
            BytesUtilities.slice(64, BytesUtilities.length(hex), hex),
            BytesUtilities.slice(0, 32, hex),
            BytesUtilities.slice(32, 64, hex)];
    }

    toChecksum(address) {
        var addressHash = sha3.keccak256(address.slice(2));
        var checksumAddress = '0x';
        for (var i = 0; i < 40; i += 1) {
            checksumAddress += parseInt(addressHash[i + 2], 16) > 7 ?
                address[i + 2].toUpperCase() :
                address[i + 2];
        } return checksumAddress;
    }
}

module.exports = EllipticDataIntegrityService;
