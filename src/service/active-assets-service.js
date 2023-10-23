import { Mutex } from 'async-mutex';
import OperationService from './operation-service.js';
import {
    // OPERATION_ID_STATUS,
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
    OPERATIONS,
    // OPERATION_REQUEST_STATUS,
    // TRIPLE_STORE_REPOSITORIES,
    // ASSET_SYNC_PARAMETERS,
} from '../constants/constants.js';

class ActiveAssetsService extends OperationService {
    constructor(ctx) {
        super(ctx);

        this.operationName = OPERATIONS.ACTIVE_ASSETS;
        this.networkProtocols = NETWORK_PROTOCOLS.ACTIVE_ASSETS;
        this.errorType = ERROR_TYPE.ACTIVE_ASSETS.ACTIVE_ASSETS_ERROR;
        // this.completedStatuses = [ ];
        this.operationMutex = new Mutex();
    }

    // async processResponse(command, responseStatus, responseData) {}
}

export default ActiveAssetsService;
