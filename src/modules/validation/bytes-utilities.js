const BN = require('bn.js');
const _ = require('underscore');

class BytesUtilities {
    /**
     * Normalizes hex number
     * @param number     Hex number
     * @returns {string|null} Normalized hex number
     */
    static normalizeHex(number) {
        if (number == null) {
            return null;
        }
        const lowerCaseNumber = number.toLowerCase();
        if (!lowerCaseNumber.startsWith('0x')) {
            return `0x${lowerCaseNumber}`;
        }
        return lowerCaseNumber;
    }

    /**
     * Denormalizes hex number
     * @param number     Hex number
     * @returns {string|null} Normalized hex number
     */
    static denormalizeHex(number) {
        if (number == null) {
            return null;
        }
        const lowerCaseNumber = number.toLowerCase();
        if (lowerCaseNumber.startsWith('0x')) {
            return lowerCaseNumber.substring(2);
        }
        return lowerCaseNumber;
    }

    /**
     * Compare HEX numbers in string representation
     * @param hex1
     * @param hex2
     * @return {*}
     */
    static compareHexStrings(hex1, hex2) {
        const denormalized1 = BytesUtilities.denormalizeHex(hex1);
        const denormalized2 = BytesUtilities.denormalizeHex(hex2);
        return new BN(denormalized1, 16).eq(new BN(denormalized2, 16));
    }

    static fromNumber(num) {
        const hex = num.toString(16);
        return hex.length % 2 === 0 ? `0x${hex}` : `0x0${hex}`;
    }

    static toNumber(hex) {
        return parseInt(hex.slice(2), 16);
    }

    static fromString(str) {
        const bn = `0x${(str.slice(0, 2) === '0x'
            ? new BN(str.slice(2), 16)
            : new BN(str, 10)
        ).toString('hex')}`;
        return bn === '0x0' ? '0x' : bn;
    }

    static fromNat(bn) {
        const intermediateNumber = bn.length % 2 === 0 ? bn : `0x0${bn.slice(2)}`;
        return bn === '0x0' ? '0x' : intermediateNumber;
    }

    static pad(l, hex) {
        return hex.length === l * 2 + 2 ? hex : BytesUtilities.pad(l, `0x0${hex.slice(2)}`);
    }

    static flatten(a) {
        return `0x${a.reduce((r, s) => r + s.slice(2), '')}`;
    }

    static slice(i, j, bs) {
        return `0x${bs.slice(i * 2 + 2, j * 2 + 2)}`;
    }

    static length(a) {
        return (a.length - 2) / 2;
    }

    static isHexStrict(hex) {
        return (_.isString(hex) || _.isNumber(hex)) && /^(-)?0x[0-9a-f]*$/i.test(hex);
    }

    static hexToBytes(number) {
        let hex = number.toString(16);

        if (!BytesUtilities.isHexStrict(hex)) {
            throw new Error(`Given value "${hex}" is not a valid hex string.`);
        }

        hex = hex.replace(/^0x/i, '');
        let bytes;
        let c;
        for (bytes = [], c = 0; c < hex.length; c += 2) {
            bytes.push(parseInt(hex.substring(c, 2), 16));
        }
        return bytes;
    }
}

module.exports = BytesUtilities;
