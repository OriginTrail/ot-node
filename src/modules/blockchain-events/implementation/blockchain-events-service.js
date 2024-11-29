import { CONTRACTS } from '../../../constants/constants.js';

class BlockchainEventsService {
    async initialize(config, logger) {
        this.logger = logger;
        this.config = config;

        this.contractsToMonitor = [
            CONTRACTS.SHARDING_TABLE_CONTRACT,
            CONTRACTS.STAKING_CONTRACT,
            CONTRACTS.PROFILE_CONTRACT,
            CONTRACTS.COMMIT_MANAGER_V1_U1_CONTRACT,
            CONTRACTS.PARAMETERS_STORAGE_CONTRACT,
            CONTRACTS.LOG2PLDSF_CONTRACT,
            CONTRACTS.LINEAR_SUM_CONTRACT,
        ];
    }

    async getBlock() {
        throw Error('getBlock not implemented');
    }

    async getPastEvents() {
        throw Error('getPastEvents not implemented');
    }
}

export default BlockchainEventsService;
