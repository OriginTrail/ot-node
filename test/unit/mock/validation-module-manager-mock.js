import { ethers } from 'ethers';

class ValidationModuleManagerMock {
    callHashFunction(data) {
        const bytesLikeData = ethers.toUtf8Bytes(data);
        return ethers.sha256(bytesLikeData);
    }

    getHashFunctionName() {
        return 'sha256';
    }

    calculateRoot(assertion) {
        return '0xde58cc52a5ce3a04ae7a05a13176226447ac02489252e4d37a72cbe0aea46b42';
    }
}

export default ValidationModuleManagerMock;
