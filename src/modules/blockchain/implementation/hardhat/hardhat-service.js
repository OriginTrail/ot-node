import { BLOCK_TIME_MILLIS } from '../../../../constants/constants.js';
import Web3Service from '../web3-service.js';

class HardhatService extends Web3Service {
    constructor(ctx) {
        super(ctx);
        this.baseTokenTicker = 'HARDHAT_TOKENS';
        this.tracTicker = 'gTRAC';
    }

    async getBlockchainTimestamp() {
        const latestBlock = await super.getLatestBlock();
        return latestBlock.timestamp;
    }

    getBlockTimeMillis() {
        return BLOCK_TIME_MILLIS.HARDHAT;
    }

    async providerReady() {
        return this.provider.ready;
    }

    async getGasPrice() {
        return this.convertToWei(20, 'wei');
    }
}

export default HardhatService;
