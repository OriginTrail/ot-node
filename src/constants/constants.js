import { BigNumber } from 'ethers';

export const UINT256_MAX_BN = BigNumber.from(2).pow(256).sub(1);

export const UINT32_MAX_BN = BigNumber.from(2).pow(32).sub(1);

export const STAKE_UINT256_MULTIPLIER_BN = UINT256_MAX_BN.div(500000000);

export const UINT256_UINT32_DIVISOR_BN = UINT256_MAX_BN.div(UINT32_MAX_BN);

export const SCHEMA_CONTEXT = 'http://schema.org/';

export const PRIVATE_ASSERTION_PREDICATE =
    'https://ontology.origintrail.io/dkg/1.0#privateAssertionID';

export const COMMIT_BLOCK_DURATION_IN_BLOCKS = 5;

export const COMMITS_DELAY_BETWEEN_NODES_IN_BLOCKS = 2;

export const TRANSACTION_POLLING_TIMEOUT_MILLIS = 50 * 1000;

export const LIBP2P_KEY_DIRECTORY = 'libp2p';

export const LIBP2P_KEY_FILENAME = 'privateKey';

export const TRIPLE_STORE_CONNECT_MAX_RETRIES = 10;

export const DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS = 15 * 24 * 60 * 60 * 1000; // 15 days

export const MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH = 500;

export const TRANSACTION_QUEUE_CONCURRENCY = 1;

export const TRIPLE_STORE_CONNECT_RETRY_FREQUENCY = 10;

export const MAX_FILE_SIZE = 2621440;

export const GET_STATES = { LATEST: 'LATEST', LATEST_FINALIZED: 'LATEST_FINALIZED' };
export const BYTES_IN_KILOBYTE = 1024;

export const BYTES_IN_MEGABYTE = BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE;

export const PUBLISH_TYPES = { ASSERTION: 'assertion', ASSET: 'asset', INDEX: 'index' };

export const DEFAULT_GET_STATE = GET_STATES.LATEST;

export const PEER_OFFLINE_LIMIT = 24 * 60 * 60 * 1000;

export const CONTENT_ASSET_HASH_FUNCTION_ID = 1;

export const TRIPLE_STORE_REPOSITORIES = {
    PUBLIC_CURRENT: 'publicCurrent',
    PUBLIC_HISTORY: 'publicHistory',
    PRIVATE_CURRENT: 'privateCurrent',
    PRIVATE_HISTORY: 'privateHistory',
};

export const PENDING_STORAGE_REPOSITORIES = {
    PUBLIC: 'public',
    PRIVATE: 'private',
};

export const REQUIRED_MODULES = [
    'repository',
    'httpClient',
    'network',
    'validation',
    'blockchain',
    'tripleStore',
];

/**
 * Triple store media types
 * @type {{APPLICATION_JSON: string, N_QUADS: string, SPARQL_RESULTS_JSON: string, LD_JSON: string}}
 */
export const MEDIA_TYPES = {
    LD_JSON: 'application/ld+json',
    N_QUADS: 'application/n-quads',
    SPARQL_RESULTS_JSON: 'application/sparql-results+json',
};

/**
 * XML data types
 * @type {{FLOAT: string, DECIMAL: string, DOUBLE: string, BOOLEAN: string, INTEGER: string}}
 */
export const XML_DATA_TYPES = {
    DECIMAL: 'http://www.w3.org/2001/XMLSchema#decimal',
    FLOAT: 'http://www.w3.org/2001/XMLSchema#float',
    DOUBLE: 'http://www.w3.org/2001/XMLSchema#double',
    INTEGER: 'http://www.w3.org/2001/XMLSchema#integer',
    BOOLEAN: 'http://www.w3.org/2001/XMLSchema#boolean',
};

export const MIN_NODE_VERSION = 16;

export const NETWORK_API_RATE_LIMIT = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    MAX_NUMBER: 20,
};

export const NETWORK_API_SPAM_DETECTION = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    MAX_NUMBER: 40,
};

export const NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES = 60;

export const HIGH_TRAFFIC_OPERATIONS_NUMBER_PER_HOUR = 16000;

export const SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES = 15;

export const PEER_RECORD_UPDATE_DELAY = 30 * 60 * 1000; // 30 minutes

export const DEFAULT_COMMAND_CLEANUP_TIME_MILLS = 4 * 24 * 60 * 60 * 1000;

export const REMOVE_SESSION_COMMAND_DELAY = 2 * 60 * 1000;

export const OPERATION_IDS_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const ASSET_SYNC_PARAMETERS = {
    COMMAND_FREQUENCY_MILLIS: 5 * 60 * 1000,
    GET_RESULT_POLLING_INTERVAL_MILLIS: 1 * 1000,
    GET_RESULT_POLLING_MAX_ATTEMPTS: 30,
    STATUS: {
        IN_PROGRESS: 'IN_PROGRESS',
        FAILED: 'FAILED',
        COMPLETED: 'COMPLETED',
        NOT_FOUND: 'NOT_FOUND',
    },
};

export const DIAL_PEERS_COMMAND_FREQUENCY_MILLS = 30 * 1000;

export const DIAL_PEERS_CONCURRENCY = 10;

export const MIN_DIAL_FREQUENCY_MILLIS = 60 * 60 * 1000;

export const PERMANENT_COMMANDS = [
    'otnodeUpdateCommand',
    'sendTelemetryCommand',
    'operationIdCleanerCommand',
    'commandsCleanerCommand',
    'dialPeersCommand',
    'assetSyncCommand',
    'epochCheckCommand',
];

export const MAX_COMMAND_DELAY_IN_MILLS = 14400 * 60 * 1000; // 10 days

export const DEFAULT_COMMAND_REPEAT_INTERVAL_IN_MILLS = 5000; // 5 seconds

export const DEFAULT_COMMAND_DELAY_IN_MILLS = 60 * 1000; // 60 seconds

export const COMMAND_RETRIES = {
    SUBMIT_COMMIT: 3,
    SUBMIT_UPDATE_COMMIT: 3,
    SUBMIT_PROOFS: 3,
};

export const WEBSOCKET_PROVIDER_OPTIONS = {
    reconnect: {
        auto: true,
        delay: 1000, // ms
        maxAttempts: 3,
    },
    clientConfig: {
        keepalive: true,
        keepaliveInterval: 30 * 1000, // ms
    },
};

export const TRIPLE_STORE_IMPLEMENTATION = {
    BLAZEGRAPH: 'Blazegraph',
    GRAPHDB: 'GraphDB',
    FUSEKI: 'Fuseki',
};

export const NETWORK_MESSAGE_TYPES = {
    REQUESTS: {
        PROTOCOL_INIT: 'PROTOCOL_INIT',
        PROTOCOL_REQUEST: 'PROTOCOL_REQUEST',
    },
    RESPONSES: {
        ACK: 'ACK',
        NACK: 'NACK',
        BUSY: 'BUSY',
    },
};

export const NETWORK_MESSAGE_TIMEOUT_MILLS = {
    PUBLISH: {
        INIT: 60 * 1000,
        REQUEST: 60 * 1000,
    },
    UPDATE: {
        INIT: 60 * 1000,
        REQUEST: 60 * 1000,
    },
    GET: {
        INIT: 60 * 1000,
        REQUEST: 60 * 1000,
    },
};

export const MAX_OPEN_SESSIONS = 10;

export const ERROR_TYPE = {
    DIAL_PROTOCOL_ERROR: 'DialProtocolError',
    VALIDATE_ASSET_ERROR: 'ValidateAssetError',
    PUBLISH: {
        PUBLISH_START_ERROR: 'PublishStartError',
        PUBLISH_ROUTE_ERROR: 'PublishRouteError',
        PUBLISH_LOCAL_STORE_ERROR: 'PublishLocalStoreError',
        PUBLISH_LOCAL_STORE_REMOTE_ERROR: 'PublishLocalStoreRemoteError',
        PUBLISH_FIND_NODES_ERROR: 'PublishFindNodesError',
        PUBLISH_STORE_INIT_ERROR: 'PublishStoreInitError',
        PUBLISH_STORE_REQUEST_ERROR: 'PublishStoreRequestError',
        PUBLISH_ERROR: 'PublishError',
        PUBLISH_REMOTE_ERROR: 'PublishRemoteError',
    },
    UPDATE: {
        UPDATE_INIT_ERROR: 'UpdateInitError',
        UPDATE_REQUEST_ERROR: 'UpdateRequestError',
        UPDATE_START_ERROR: 'UpdateStartError',
        UPDATE_ROUTE_ERROR: 'UpdateRouteError',
        UPDATE_LOCAL_STORE_ERROR: 'UpdateLocalStoreError',
        UPDATE_LOCAL_STORE_REMOTE_ERROR: 'UpdateLocalStoreRemoteError',
        UPDATE_ERROR: 'UpdateError',
        UPDATE_STORE_INIT_ERROR: 'UpdateStoreInitError',
        UPDATE_REMOTE_ERROR: 'UpdateRemoteError',
        UPDATE_DELETE_PENDING_STATE_ERROR: 'UpdateDeletePendingStateError',
    },
    GET: {
        GET_ROUTE_ERROR: 'GetRouteError',
        GET_ASSERTION_ID_ERROR: 'GetAssertionIdError',
        GET_LOCAL_ERROR: 'GetLocalError',
        GET_NETWORK_ERROR: 'GetNetworkError',
        GET_START_ERROR: 'GetStartError',
        GET_INIT_ERROR: 'GetInitError',
        GET_REQUEST_ERROR: 'GetRequestError',
        GET_INIT_REMOTE_ERROR: 'GetInitRemoteError',
        GET_REQUEST_REMOTE_ERROR: 'GetRequestRemoteError',
        GET_ERROR: 'GetError',
    },
    LOCAL_STORE: {
        LOCAL_STORE_ERROR: 'LocalStoreError',
    },
    QUERY: {
        LOCAL_QUERY_ERROR: 'LocalQueryError',
    },
    COMMIT_PROOF: {
        CALCULATE_PROOFS_ERROR: 'CalculateProofsError',
        EPOCH_CHECK_ERROR: 'EpochCheckError',
        SUBMIT_COMMIT_ERROR: 'SubmitCommitError',
        SUBMIT_PROOFS_ERROR: 'SubmitProofsError',
        SUBMIT_UPDATE_COMMIT_ERROR: 'SubmitUpdateCommitError',
    },
};
export const OPERATION_ID_STATUS = {
    PENDING: 'PENDING',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
    FIND_NODES_START: 'FIND_NODES_START',
    FIND_NODES_END: 'FIND_NODES_END',
    FIND_NODES_LOCAL_START: 'FIND_NODES_LOCAL_START',
    FIND_NODES_LOCAL_END: 'FIND_NODES_LOCAL_END',
    DIAL_PROTOCOL_START: 'DIAL_PROTOCOL_START',
    DIAL_PROTOCOL_END: 'DIAL_PROTOCOL_END',
    VALIDATE_ASSET_START: 'VALIDATE_ASSET_START',
    VALIDATE_ASSET_END: 'VALIDATE_ASSET_END',
    VALIDATE_ASSET_REMOTE_START: 'VALIDATE_ASSET_REMOTE_START',
    VALIDATE_ASSET_REMOTE_END: 'VALIDATE_ASSET_REMOTE_END',
    PUBLISH: {
        VALIDATING_PUBLISH_ASSERTION_REMOTE_START: 'VALIDATING_PUBLISH_ASSERTION_REMOTE_START',
        VALIDATING_PUBLISH_ASSERTION_REMOTE_END: 'VALIDATING_PUBLISH_ASSERTION_REMOTE_END',
        INSERTING_ASSERTION: 'INSERTING_ASSERTION',
        PUBLISHING_ASSERTION: 'PUBLISHING_ASSERTION',
        PUBLISH_START: 'PUBLISH_START',
        PUBLISH_INIT_START: 'PUBLISH_INIT_START',
        PUBLISH_INIT_END: 'PUBLISH_INIT_END',
        PUBLISH_LOCAL_STORE_START: 'PUBLISH_LOCAL_STORE_START',
        PUBLISH_LOCAL_STORE_END: 'PUBLISH_LOCAL_STORE_END',
        PUBLISH_REPLICATE_START: 'PUBLISH_REPLICATE_START',
        PUBLISH_REPLICATE_END: 'PUBLISH_REPLICATE_END',
        PUBLISH_END: 'PUBLISH_END',
    },
    UPDATE: {
        UPDATE_START: 'UPDATE_START',
        UPDATE_INIT_START: 'UPDATE_INIT_START',
        UPDATE_INIT_END: 'UPDATE_INIT_END',
        UPDATE_REPLICATE_START: 'UPDATE_REPLICATE_START',
        UPDATE_REPLICATE_END: 'UPDATE_REPLICATE_END',
        VALIDATING_UPDATE_ASSERTION_REMOTE_START: 'VALIDATING_UPDATE_ASSERTION_REMOTE_START',
        VALIDATING_UPDATE_ASSERTION_REMOTE_END: 'VALIDATING_UPDATE_ASSERTION_REMOTE_END',
        UPDATE_END: 'UPDATE_END',
    },
    GET: {
        ASSERTION_EXISTS_LOCAL_START: 'ASSERTION_EXISTS_LOCAL_START',
        ASSERTION_EXISTS_LOCAL_END: 'ASSERTION_EXISTS_LOCAL_END',
        GET_START: 'GET_START',
        GET_INIT_START: 'GET_INIT_START',
        GET_INIT_END: 'GET_INIT_END',
        GET_LOCAL_START: 'GET_LOCAL_START',
        GET_LOCAL_END: 'GET_LOCAL_END',
        GET_REMOTE_START: 'GET_REMOTE_START',
        GET_REMOTE_END: 'GET_REMOTE_END',
        GET_FETCH_FROM_NODES_START: 'GET_FETCH_FROM_NODES_START',
        GET_FETCH_FROM_NODES_END: 'GET_FETCH_FROM_NODES_END',
        GET_END: 'GET_END',
    },
    COMMIT_PROOF: {
        EPOCH_CHECK_START: 'EPOCH_CHECK_START',
        EPOCH_CHECK_END: 'EPOCH_CHECK_END',
        SUBMIT_COMMIT_START: 'SUBMIT_COMMIT_START',
        SUBMIT_COMMIT_END: 'SUBMIT_COMMIT_END',
        CALCULATE_PROOFS_START: 'CALCULATE_PROOFS_START',
        CALCULATE_PROOFS_END: 'CALCULATE_PROOFS_END',
        SUBMIT_PROOFS_START: 'SUBMIT_PROOFS_START',
        SUBMIT_PROOFS_END: 'SUBMIT_PROOFS_END',
        SUBMIT_UPDATE_COMMIT_START: 'SUBMIT_UPDATE_COMMIT_START',
        SUBMIT_UPDATE_COMMIT_END: 'SUBMIT_UPDATE_COMMIT_END',
    },
    QUERY: {
        QUERY_INIT_START: 'QUERY_INIT_START',
        QUERY_INIT_END: 'QUERY_INIT_END',
        QUERY_START: 'QUERY_START',
        QUERY_END: 'QUERY_END',
    },
    LOCAL_STORE: {
        LOCAL_STORE_INIT_START: 'LOCAL_STORE_INIT_START',
        LOCAL_STORE_INIT_END: 'LOCAL_STORE_INIT_END',
        LOCAL_STORE_START: 'LOCAL_STORE_START',
        LOCAL_STORE_END: 'LOCAL_STORE_END',
    },
};

export const OPERATIONS = {
    PUBLISH: 'publish',
    UPDATE: 'update',
    GET: 'get',
};

/**
 * @constant {number} OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS -
 * operation id command cleanup interval time 24h
 */
export const OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;
/**
 * @constant {number} FINALIZED_COMMAND_CLEANUP_TIME_MILLS - Command cleanup interval time
 * finalized commands command cleanup interval time 24h
 */
export const FINALIZED_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const COMMANDS_FOR_REMOVAL_MAX_NUMBER = 1000;

export const ARCHIVE_COMMANDS_FOLDER = 'commands';
/**
 * @constant {number} COMMAND_STATUS -
 * Status for commands
 */
export const COMMAND_STATUS = {
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    UNKNOWN: 'UNKNOWN',
    STARTED: 'STARTED',
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    REPEATING: 'REPEATING',
};

/**
 * How many commands will run in parallel
 * @type {number}
 */
export const COMMAND_QUEUE_PARALLELISM = 100;

/**
 * @constant {object} NETWORK_PROTOCOLS -
 *  Network protocols
 */
export const NETWORK_PROTOCOLS = {
    STORE: ['/store/1.0.0'],
    UPDATE: ['/update/1.0.0'],
    GET: ['/get/1.0.0'],
};

export const OPERATION_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};

export const AGREEMENT_STATUS = {
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
};

export const OPERATION_REQUEST_STATUS = {
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};

/**
 * Local query types
 * @type {{CONSTRUCT: string, SELECT: string}}
 */
export const QUERY_TYPES = {
    SELECT: 'SELECT',
    CONSTRUCT: 'CONSTRUCT',
};

/**
 * Local store types
 * @type {{TRIPLE: string, PENDING: string}}
 */
export const LOCAL_STORE_TYPES = {
    TRIPLE: 'TRIPLE',
    PENDING: 'PENDING',
};

/**
 * Contract names
 * @type {{SHARDING_TABLE_CONTRACT: string}}
 */
export const CONTRACTS = {
    SHARDING_TABLE_CONTRACT: 'ShardingTableContract',
    STAKING_CONTRACT: 'StakingContract',
    PROFILE_CONTRACT: 'ProfileContract',
    HUB_CONTRACT: 'HubContract',
    COMMIT_MANAGER_V1_U1_CONTRACT: 'CommitManagerV1U1Contract',
    SERVICE_AGREEMENT_V1_CONTRACT: 'ServiceAgreementV1Contract',
};

export const CONTRACT_EVENTS = {
    HUB: {
        NEW_CONTRACT: 'NewContract',
        CONTRACT_CHANGED: 'ContractChanged',
        NEW_ASSET_STORAGE: 'NewAssetStorage',
        ASSET_STORAGE_CHANGED: 'AssetStorageChanged',
    },
    SHARDING_TABLE: {
        NODE_ADDED: 'NodeAdded',
        NODE_REMOVED: 'NodeRemoved',
    },
    STAKING: {
        STAKE_INCREASED: 'StakeIncreased',
        STAKE_WITHDRAWAL_STARTED: 'StakeWithdrawalStarted',
    },
    PROFILE: {
        ASK_UPDATED: 'AskUpdated',
    },
    COMMIT_MANAGER_V1: {
        STATE_FINALIZED: 'StateFinalized',
    },
    SERVICE_AGREEMENT_V1: {
        SERVICE_AGREEMENT_V1_EXTENDED: 'ServiceAgreementV1Extended',
        SERVICE_AGREEMENT_V1_TERMINATED: 'ServiceAgreementV1Terminated',
    },
};

export const NODE_ENVIRONMENTS = {
    DEVELOPMENT: 'development',
    TEST: 'test',
    TESTNET: 'testnet',
    MAINNET: 'mainnet',
};

export const CONTRACT_EVENT_FETCH_INTERVALS = {
    MAINNET: 10 * 1000,
    DEVELOPMENT: 4 * 1000,
};

export const FIXED_GAS_LIMIT_METHODS = {
    submitCommit: 600000,
    submitUpdateCommit: 600000,
    sendProof: 500000,
};

export const BLOCK_TIME_MILLIS = {
    OTP: 12_000,
    HARDHAT: 5_000,
    DEFAULT: 12_000,
};

export const TRANSACTION_CONFIRMATIONS = 1;
