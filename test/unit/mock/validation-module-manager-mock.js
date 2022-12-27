import { ethers } from 'ethers';

class ValidationModuleManagerMock {
    callHashFunction(data) {
        const bytesLikeData = ethers.utils.toUtf8Bytes(data);
        return ethers.utils.sha256(bytesLikeData);
    }

    getHashFunctionName() {
        return 'sha256';
    }
}

export default ValidationModuleManagerMock;
