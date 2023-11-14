import { ethers } from 'ethers';

class BlockchainModuleManagerMock {
    getR2() {
        return 20;
    }

    getR1() {
        return 8;
    }

    getR0() {
        return 3;
    }

    encodePacked(blockchain, types, values) {
        return ethers.solidityPacked(types, values);
    }

    convertBytesToUint8Array(blockchain, bytesLikeData) {
        return ethers.toBeArray(bytesLikeData);
    }

    convertToWei(blockchainId, value) {
        return ethers.parseUnits(value.toString(), 'ether').toString();
    }

    toBigNumber(blockchain, value) {
        return BigInt(value);
    }

    getAssertionSize(blockchain, assertionId) {
        return 246;
    }

    getAssertionTriplesNumber(blockchain, assertionId) {
        return undefined;
    }

    getAssertionChunksNumber(blockchain, assertionId) {
        return undefined;
    }
}

export default BlockchainModuleManagerMock;
