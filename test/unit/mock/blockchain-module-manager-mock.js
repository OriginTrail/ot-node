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
        return ethers.utils.solidityPack(types, values);
    }

    convertBytesToUint8Array(blockchain, bytesLikeData) {
        return ethers.utils.arrayify(bytesLikeData);
    }

    convertToWei(blockchainId, value) {
        return ethers.utils.parseUnits(value.toString(), 'ether');
    }

    toBigNumber(blockchain, value) {
        return ethers.BigNumber.from(value);
    }

    getAssertionSize(blockchain, assertionMerkleRoot) {
        return 246;
    }

    getAssertionTriplesNumber(blockchain, assertionMerkleRoot) {
        return undefined;
    }

    getAssertionChunksNumber(blockchain, assertionMerkleRoot) {
        return undefined;
    }
}

export default BlockchainModuleManagerMock;
