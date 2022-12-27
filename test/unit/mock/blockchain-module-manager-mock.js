import { ethers } from 'ethers';

class BlockchainModuleManagerMock {
    getR2() {
        return 20;
    }

    getR0() {
        return 3;
    }

    convertToWei(blockchainId, value) {
        return ethers.utils.parseUnits(value.toString(), 'ether').toString();
    }
}

export default BlockchainModuleManagerMock;
