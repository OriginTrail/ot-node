import { ethers } from 'ethers';
// TODO: Remove whole file
class HashingService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;

        this.hashFunctions = {
            1: 'sha256',
        };
    }

    callHashFunction(hashFunctionId, data) {
        const hashFunctionName = this.getHashFunctionName(hashFunctionId);
        return this[hashFunctionName](data);
    }

    getHashFunctionName(hashFunctionId) {
        return this.hashFunctions[hashFunctionId];
    }

    sha256(data) {
        if (!ethers.utils.isBytesLike(data)) {
            const bytesLikeData = ethers.utils.toUtf8Bytes(data);
            return ethers.utils.sha256(bytesLikeData);
        }
        return ethers.utils.sha256(data);
    }
}

export default HashingService;
