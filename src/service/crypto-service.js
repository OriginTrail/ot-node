import ethers from 'ethers';

class CryptoService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    toBigNumber(value) {
        return ethers.BigNumber.from(value);
    }

    keccak256(data) {
        if (!ethers.utils.isBytesLike(data)) {
            const bytesLikeData = ethers.utils.toUtf8Bytes(data);
            return ethers.utils.keccak256(bytesLikeData);
        }
        return ethers.utils.keccak256(data);
    }

    sha256(data) {
        if (!ethers.utils.isBytesLike(data)) {
            const bytesLikeData = ethers.utils.toUtf8Bytes(data);
            return ethers.utils.sha256(bytesLikeData);
        }
        return ethers.utils.sha256(data);
    }

    encodePacked(types, values) {
        return ethers.utils.solidityPack(types, values);
    }

    convertUint8ArrayToHex(uint8Array) {
        return ethers.utils.hexlify(uint8Array);
    }

    convertAsciiToHex(string) {
        return this.convertUint8ArrayToHex(ethers.utils.toUtf8Bytes(string));
    }

    convertHexToAscii(hexString) {
        return ethers.utils.toUtf8String(hexString);
    }

    convertBytesToUint8Array(bytesLikeData) {
        return ethers.utils.arrayify(bytesLikeData);
    }

    convertToWei(value, fromUnit = 'ether') {
        return ethers.utils.parseUnits(value.toString(), fromUnit);
    }

    convertFromWei(value, toUnit = 'ether') {
        return ethers.utils.formatUnits(value, toUnit);
    }

    hashMessage(message) {
        return ethers.utils.hashMessage(message);
    }

    async signMessage(messageHash) {
        const wallet = this.getRandomOperationalWallet();
        const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));
        return { signer: wallet.address, signature };
    }

    splitSignature(flatSignature) {
        return ethers.utils.splitSignature(flatSignature);
    }
}

export default CryptoService;
