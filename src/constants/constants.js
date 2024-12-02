import { BigNumber, ethers } from 'ethers';

export const WS_RPC_PROVIDER_PRIORITY = 2;

export const HTTP_RPC_PROVIDER_PRIORITY = 1;

export const FALLBACK_PROVIDER_QUORUM = 1;

export const RPC_PROVIDER_STALL_TIMEOUT = 60 * 1000;

export const UINT256_MAX_BN = ethers.constants.MaxUint256;

export const UINT128_MAX_BN = BigNumber.from(2).pow(128).sub(1);

export const UINT64_MAX_BN = BigNumber.from(2).pow(64).sub(1);

export const UINT40_MAX_BN = BigNumber.from(2).pow(40).sub(1);

export const UINT32_MAX_BN = BigNumber.from(2).pow(32).sub(1);

export const HASH_RING_SIZE = ethers.constants.MaxUint256;

export const STAKE_UINT256_MULTIPLIER_BN = UINT256_MAX_BN.div(500000000);

export const UINT256_UINT32_DIVISOR_BN = UINT256_MAX_BN.div(UINT32_MAX_BN);

export const ZERO_PREFIX = '0x';

export const ZERO_BYTES32 = ethers.constants.HashZero;

export const ZERO_ADDRESS = ethers.constants.AddressZero;

export const SCHEMA_CONTEXT = 'http://schema.org/';

export const PRIVATE_ASSERTION_PREDICATE =
    'https://ontology.origintrail.io/dkg/1.0#privateAssertionID';
export const UAL_PREDICATE = '<https://ontology.origintrail.io/dkg/1.0#UAL>';

export const COMMIT_BLOCK_DURATION_IN_BLOCKS = 5;

export const COMMITS_DELAY_BETWEEN_NODES_IN_BLOCKS = 5;

export const TRANSACTION_POLLING_TIMEOUT_MILLIS = 300 * 1000;

export const SOLIDITY_ERROR_STRING_PREFIX = '0x08c379a0';

export const SOLIDITY_PANIC_CODE_PREFIX = '0x4e487b71';

export const SOLIDITY_PANIC_REASONS = {
    0x1: 'Assertion error',
    0x11: 'Arithmetic operation underflowed or overflowed outside of an unchecked block',
    0x12: 'Division or modulo division by zero',
    0x21: 'Tried to convert a value into an enum, but the value was too big or negative',
    0x22: 'Incorrectly encoded storage byte array',
    0x31: '.pop() was called on an empty array',
    0x32: 'Array accessed at an out-of-bounds or negative index',
    0x41: 'Too much memory was allocated, or an array was created that is too large',
    0x51: 'Called a zero-initialized variable of internal function type',
};

export const LIBP2P_KEY_DIRECTORY = 'libp2p';

export const LIBP2P_KEY_FILENAME = 'privateKey';

export const BLS_KEY_DIRECTORY = 'bls';

export const BLS_KEY_FILENAME = 'secretKey';

export const TRIPLE_STORE_CONNECT_MAX_RETRIES = 10;

export const COMMAND_PRIORITY = {
    HIGHEST: 0,
    HIGH: 1,
    MEDIUM: 5,
    LOW: 10,
    LOWEST: 20,
};

export const DEFAULT_COMMAND_PRIORITY = COMMAND_PRIORITY.MEDIUM;

export const DEFAULT_BLOCKCHAIN_EVENT_SYNC_PERIOD_IN_MILLS = 15 * 24 * 60 * 60 * 1000; // 15 days

export const MAX_BLOCKCHAIN_EVENT_SYNC_OF_HISTORICAL_BLOCKS_IN_MILLS = 60 * 60 * 1000; // 1 hour

export const MAXIMUM_NUMBERS_OF_BLOCKS_TO_FETCH = 50;

export const TRANSACTION_QUEUE_CONCURRENCY = 1;

export const TRIPLE_STORE_CONNECT_RETRY_FREQUENCY = 10;

export const MAX_FILE_SIZE = 524288000;

export const GET_STATES = { LATEST: 'LATEST', FINALIZED: 'LATEST_FINALIZED' };

export const BYTES_IN_KILOBYTE = 1024;

export const BYTES_IN_MEGABYTE = BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE;

export const PUBLISH_TYPES = { ASSERTION: 'assertion', ASSET: 'asset', INDEX: 'index' };

export const DEFAULT_GET_STATE = GET_STATES.LATEST;

export const PEER_OFFLINE_LIMIT = 24 * 60 * 60 * 1000;

export const CONTENT_ASSET_HASH_FUNCTION_ID = 1;

export const PARANET_SYNC_KA_COUNT = 50;
export const PARANET_SYNC_RETRIES_LIMIT = 3;
export const PARANET_SYNC_RETRY_DELAY_MS = 60 * 1000;

export const PARANET_ACCESS_POLICY = {
    OPEN: 0,
    CURATED: 1,
};

export const TRIPLE_STORE_REPOSITORIES = {
    DKG: 'dkg',
};

export const BASE_NAMED_GRAPHS = {
    UNIFIED: 'unified:graph',
    HISTORICAL_UNIFIED: 'historical-unified:graph',
    METADATA: 'metadata:graph',
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
    MAX_NUMBER: 100,
};

export const NETWORK_API_SPAM_DETECTION = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    MAX_NUMBER: 150,
};

export const NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES = 60;

export const HIGH_TRAFFIC_OPERATIONS_NUMBER_PER_HOUR = 16000;

export const SHARDING_TABLE_CHECK_COMMAND_FREQUENCY_MINUTES = 30;

export const PARANET_SYNC_FREQUENCY_MILLS = 1 * 60 * 1000;

export const SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES = 15;

export const PEER_RECORD_UPDATE_DELAY = 30 * 60 * 1000; // 30 minutes

export const DEFAULT_COMMAND_CLEANUP_TIME_MILLS = 4 * 24 * 60 * 60 * 1000;

export const REMOVE_SESSION_COMMAND_DELAY = 2 * 60 * 1000;

export const OPERATION_IDS_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const GET_LATEST_SERVICE_AGREEMENT_FREQUENCY_MILLS = 30 * 1000;

export const DIAL_PEERS_COMMAND_FREQUENCY_MILLS = 30 * 1000;

export const DIAL_PEERS_CONCURRENCY = 10;

export const MIN_DIAL_FREQUENCY_MILLIS = 60 * 60 * 1000;

export const PERMANENT_COMMANDS = [
    'otnodeUpdateCommand',
    'sendTelemetryCommand',
    'shardingTableCheckCommand',
    'operationIdCleanerCommand',
    'commandsCleanerCommand',
    'dialPeersCommand',
    'blockchainEventCleanerCommand',
    'getCleanerCommand',
    'getResponseCleanerCommand',
    'publishCleanerCommand',
    'publishResponseCleanerCommand',
    'updateCleanerCommand',
    'updateResponseCleanerCommand',
    'startParanetSyncCommands',
    'pendingStorageCleanerCommand',
];

export const MAX_COMMAND_DELAY_IN_MILLS = 14400 * 60 * 1000; // 10 days

export const DEFAULT_COMMAND_REPEAT_INTERVAL_IN_MILLS = 5000; // 5 seconds

export const DEFAULT_COMMAND_DELAY_IN_MILLS = 60 * 1000; // 60 seconds

export const TRANSACTION_PRIORITY = {
    HIGHEST: 0,
    HIGH: 1,
    MEDIUM: 5,
    LOW: 10,
    LOWEST: 20,
};

export const CONTRACT_FUNCTION_PRIORITY = {
    'submitCommit((address,uint256,bytes,uint8,uint16,uint72,uint72,uint72))':
        TRANSACTION_PRIORITY.MEDIUM,
    'submitCommit((address,uint256,bytes,uint8,uint16))': TRANSACTION_PRIORITY.MEDIUM,
    'submitUpdateCommit((address,uint256,bytes,uint8,uint16,uint72,uint72,uint72))':
        TRANSACTION_PRIORITY.HIGH,
    'submitUpdateCommit((address,uint256,bytes,uint8,uint16))': TRANSACTION_PRIORITY.HIGH,
    sendProof: TRANSACTION_PRIORITY.MEDIUM,
};

export const COMMAND_RETRIES = {
    SIMPLE_ASSET_SYNC: 1,
    SUBMIT_COMMIT: 5,
    SUBMIT_UPDATE_COMMIT: 5,
    SUBMIT_PROOFS: 5,
};

export const SIMPLE_ASSET_SYNC_PARAMETERS = {
    GET_RESULT_POLLING_INTERVAL_MILLIS: 1 * 1000,
    GET_RESULT_POLLING_MAX_ATTEMPTS: 30,
};

export const PARANET_SYNC_PARAMETERS = {
    GET_RESULT_POLLING_INTERVAL_MILLIS: 1 * 1000,
    GET_RESULT_POLLING_MAX_ATTEMPTS: 300,
};

export const COMMAND_TX_GAS_INCREASE_FACTORS = {
    SUBMIT_COMMIT: 1.2,
    SUBMIT_UPDATE_COMMIT: 1.2,
    SUBMIT_PROOFS: 1.2,
};

export const CONTRACT_FUNCTION_GAS_LIMIT_INCREASE_FACTORS = {
    sendProof: 2,
    'submitCommit((address,uint256,bytes,uint8,uint16))': 2,
    'submitCommit((address,uint256,bytes,uint8,uint16,uint72,uint72,uint72))': 2,
    'submitUpdateCommit((address,uint256,bytes,uint8,uint16,uint72,uint72,uint72))': 2,
    'submitUpdateCommit((address,uint256,bytes,uint8,uint16))': 2,
};

export const GNOSIS_DEFAULT_GAS_PRICE = {
    TESTNET: 25,
    MAINNET: 5,
};

export const NEURO_DEFAULT_GAS_PRICE = {
    TESTNET: 8,
    MAINNET: 8,
};

export const CONTRACT_FUNCTION_FIXED_GAS_PRICE = {
    'otp:2043': {
        SUBMIT_UPDATE_COMMIT: 30,
    },
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

export const PARANET_NODES_ACCESS_POLICIES = ['OPEN', 'CURATED'];

export const NETWORK_MESSAGE_TIMEOUT_MILLS = {
    PUBLISH: {
        REQUEST: 60 * 1000,
    },
    UPDATE: {
        INIT: 60 * 1000,
        REQUEST: 60 * 1000,
    },
    GET: {
        INIT: 60 * 1000,
        REQUEST: 5 * 60 * 1000,
    },
};

export const MAX_OPEN_SESSIONS = 10;

export const ERROR_TYPE = {
    DIAL_PROTOCOL_ERROR: 'DialProtocolError',
    VALIDATE_ASSET_ERROR: 'ValidateAssetError',
    PUBLISH: {
        PUBLISH_START_ERROR: 'PublishStartError',
        PUBLISH_ROUTE_ERROR: 'PublishRouteError',
        PUBLISH_VALIDATE_ASSET_ERROR: 'PublishValidateAssetError',
        PUBLISH_LOCAL_STORE_ERROR: 'PublishLocalStoreError',
        PUBLISH_LOCAL_STORE_REMOTE_ERROR: 'PublishLocalStoreRemoteError',
        PUBLISH_FIND_NODES_ERROR: 'PublishFindNodesError',
        PUBLISH_STORE_REQUEST_ERROR: 'PublishStoreRequestError',
        PUBLISH_ERROR: 'PublishError',
    },
    VALIDATE_ASSERTION_METADATA_ERROR: 'ValidateAssertionMetadataError',
    STORE_ASSERTION_ERROR: 'StoreAssertionError',
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
        GET_PRIVATE_ASSERTION_ID_ERROR: 'GetPrivateAssertionIdError',
        GET_VALIDATE_ASSET_ERROR: 'GetValidateAssetError',
        GET_LOCAL_ERROR: 'GetLocalError',
        GET_NETWORK_ERROR: 'GetNetworkError',
        GET_CURATED_PARANET_NETWORK_ERROR: 'GetCuratedParanetNetworkError',
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
        BLOCKCHAIN_EPOCH_CHECK_ERROR: 'BlockchainEpochCheckError',
        SIMPLE_ASSET_SYNC_ERROR: 'SimpleAssetSyncError',
        SUBMIT_COMMIT_ERROR: 'SubmitCommitError',
        SUBMIT_COMMIT_SEND_TX_ERROR: 'SubmitCommitSendTxError',
        SUBMIT_PROOFS_ERROR: 'SubmitProofsError',
        SUBMIT_PROOFS_SEND_TX_ERROR: 'SubmitProofsSendTxError',
        SUBMIT_UPDATE_COMMIT_ERROR: 'SubmitUpdateCommitError',
        SUBMIT_UPDATE_COMMIT_SEND_TX_ERROR: 'SubmitUpdateCommitSendTxError',
    },
    GET_BID_SUGGESTION: {
        UNSUPPORTED_BID_SUGGESTION_RANGE_ERROR: 'UnsupportedBidSuggestionRangeError',
    },
    PARANET: {
        START_PARANET_SYNC_ERROR: 'StartParanetSyncError',
        PARANET_SYNC_ERROR: 'ParanetSyncError',
    },
    FIND_SHARD: {
        FIND_SHARD_ERROR: 'FindShardError',
        PUBLISH_FIND_SHARD_ERROR: 'PublishFindShardError',
        GET_FIND_SHARD_ERROR: 'GetFindShardError',
    },
};
export const OPERATION_ID_STATUS = {
    PENDING: 'PENDING',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
    FIND_NODES_START: 'FIND_NODES_START',
    FIND_NODES_END: 'FIND_NODES_END',
    FIND_CURATED_PARANET_NODES_START: 'FIND_CURATED_PARANET_NODES_START',
    FIND_CURATED_PARANET_NODES_END: 'FIND_CURATED_PARANET_NODES_END',
    DIAL_PROTOCOL_START: 'DIAL_PROTOCOL_START',
    DIAL_PROTOCOL_END: 'DIAL_PROTOCOL_END',
    VALIDATE_ASSET_START: 'VALIDATE_ASSET_START',
    VALIDATE_ASSET_END: 'VALIDATE_ASSET_END',
    VALIDATE_ASSET_BLOCKCHAIN_START: 'VALIDATE_ASSET_BLOCKCHAIN_START',
    VALIDATE_ASSET_BLOCKCHAIN_END: 'VALIDATE_ASSET_BLOCKCHAIN_END',
    VALIDATE_ASSET_REMOTE_START: 'VALIDATE_ASSET_REMOTE_START',
    VALIDATE_ASSET_REMOTE_END: 'VALIDATE_ASSET_REMOTE_END',
    PUBLISH: {
        VALIDATING_PUBLISH_ASSERTION_REMOTE_START: 'VALIDATING_PUBLISH_ASSERTION_REMOTE_START',
        VALIDATING_PUBLISH_ASSERTION_REMOTE_END: 'VALIDATING_PUBLISH_ASSERTION_REMOTE_END',
        PUBLISH_VALIDATE_ASSET_START: 'PUBLISH_VALIDATE_ASSET_START',
        PUBLISH_VALIDATE_ASSET_END: 'PUBLISH_VALIDATE_ASSET_END',
        INSERTING_ASSERTION: 'INSERTING_ASSERTION',
        PUBLISHING_ASSERTION: 'PUBLISHING_ASSERTION',
        PUBLISH_START: 'PUBLISH_START',
        PUBLISH_INIT_START: 'PUBLISH_INIT_START',
        PUBLISH_INIT_END: 'PUBLISH_INIT_END',
        PUBLISH_LOCAL_STORE_START: 'PUBLISH_LOCAL_STORE_START',
        PUBLISH_LOCAL_STORE_END: 'PUBLISH_LOCAL_STORE_END',
        PUBLISH_REPLICATE_START: 'PUBLISH_REPLICATE_START',
        PUBLISH_REPLICATE_END: 'PUBLISH_REPLICATE_END',
        PUBLISH_FIND_NODES_START: 'PUBLISH_FIND_NODES_START',
        PUBLISH_FIND_NODES_END: 'PUBLISH_FIND_NODES_END',
        PUBLISH_END: 'PUBLISH_END',
    },
    PUBLISH_FINALIZATION: {
        PUBLISH_FINALIZATION_START: 'PUBLISH_FINALIZATION_START',
        PUBLISH_FINALIZATION_METADATA_VALIDATION_START:
            'PUBLISH_FINALIZATION_METADATA_VALIDATION_START',
        PUBLISH_FINALIZATION_METADATA_VALIDATION_END:
            'PUBLISH_FINALIZATION_METADATA_VALIDATION_END',
        PUBLISH_FINALIZATION_STORE_ASSERTION_START: 'PUBLISH_FINALIZATION_STORE_ASSERTION_START',
        PUBLISH_FINALIZATION_STORE_ASSERTION_END: 'PUBLISH_FINALIZATION_STORE_ASSERTION_END',
        PUBLISH_FINALIZATION_END: 'PUBLISH_FINALIZATION_END',
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
        GET_VALIDATE_ASSET_START: 'GET_VALIDATE_ASSET_START',
        GET_VALIDATE_ASSET_END: 'GET_VALIDATE_ASSET_END',
        GET_LOCAL_START: 'GET_LOCAL_START',
        GET_LOCAL_END: 'GET_LOCAL_END',
        GET_REMOTE_START: 'GET_REMOTE_START',
        GET_REMOTE_END: 'GET_REMOTE_END',
        GET_FETCH_FROM_NODES_START: 'GET_FETCH_FROM_NODES_START',
        GET_FETCH_FROM_NODES_END: 'GET_FETCH_FROM_NODES_END',
        GET_FIND_NODES_START: 'GET_FIND_NODES_START',
        GET_FIND_NODES_END: 'PUBLISH_FIND_NODES_END',
        GET_END: 'GET_END',
    },
    COMMIT_PROOF: {
        EPOCH_CHECK_START: 'EPOCH_CHECK_START',
        EPOCH_CHECK_END: 'EPOCH_CHECK_END',
        SIMPLE_ASSET_SYNC_START: 'SIMPLE_ASSET_SYNC_START',
        SIMPLE_ASSET_SYNC_END: 'SIMPLE_ASSET_SYNC_END',
        SUBMIT_COMMIT_START: 'SUBMIT_COMMIT_START',
        SUBMIT_COMMIT_END: 'SUBMIT_COMMIT_END',
        SUBMIT_COMMIT_SEND_TX_START: 'SUBMIT_COMMIT_SEND_TX_START',
        SUBMIT_COMMIT_SEND_TX_END: 'SUBMIT_COMMIT_SEND_TX_END',
        CALCULATE_PROOFS_START: 'CALCULATE_PROOFS_START',
        CALCULATE_PROOFS_END: 'CALCULATE_PROOFS_END',
        SUBMIT_PROOFS_START: 'SUBMIT_PROOFS_START',
        SUBMIT_PROOFS_END: 'SUBMIT_PROOFS_END',
        SUBMIT_PROOFS_SEND_TX_START: 'SUBMIT_PROOFS_START',
        SUBMIT_PROOFS_SEND_TX_END: 'SUBMIT_PROOFS_END',
        SUBMIT_UPDATE_COMMIT_START: 'SUBMIT_UPDATE_COMMIT_START',
        SUBMIT_UPDATE_COMMIT_END: 'SUBMIT_UPDATE_COMMIT_END',
        SUBMIT_UPDATE_COMMIT_SEND_TX_START: 'SUBMIT_UPDATE_COMMIT_START',
        SUBMIT_UPDATE_COMMIT_SEND_TX_END: 'SUBMIT_UPDATE_COMMIT_END',
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
    PARANET: {
        PARANET_SYNC_START: 'PARANET_SYNC_START',
        PARANET_SYNC_END: 'PARANET_SYNC_END',
        PARANET_SYNC_MISSED_KAS_SYNC_START: 'PARANET_SYNC_MISSED_KAS_SYNC_START',
        PARANET_SYNC_MISSED_KAS_SYNC_END: 'PARANET_SYNC_MISSED_KAS_SYNC_END',
        PARANET_SYNC_NEW_KAS_SYNC_START: 'PARANET_SYNC_NEW_KAS_SYNC_START',
        PARANET_SYNC_NEW_KAS_SYNC_END: 'PARANET_SYNC_NEW_KAS_SYNC_END',
    },
};

export const OPERATIONS = {
    PUBLISH: 'publish',
    UPDATE: 'update',
    GET: 'get',
};

export const SERVICE_AGREEMENT_START_TIME_DELAY_FOR_COMMITS_SECONDS = {
    mainnet: 5 * 60,
    testnet: 5 * 60,
    devnet: 3 * 60,
    test: 10,
    development: 10,
};

export const EXPECTED_TRANSACTION_ERRORS = {
    INSUFFICIENT_FUNDS: 'InsufficientFunds',
    NODE_ALREADY_SUBMITTED_COMMIT: 'NodeAlreadySubmittedCommit',
    TIMEOUT_EXCEEDED: 'timeout exceeded',
    TOO_LOW_PRIORITY: 'TooLowPriority',
    NODE_ALREADY_REWARDED: 'NodeAlreadyRewarded',
    SERVICE_AGREEMENT_DOESNT_EXIST: 'ServiceAgreementDoesntExist',
    INVALID_PROXIMITY_SCORE_FUNCTIONS_PAIR_ID: 'InvalidProximityScoreFunctionsPairId',
    INVALID_SCORE_FUNCTION_ID: 'InvalidScoreFunctionId',
    COMMIT_WINDOW_CLOSED: 'CommitWindowClosed',
    NODE_NOT_IN_SHARDING_TABLE: 'NodeNotInShardingTable',
    PROOF_WINDOW_CLOSED: 'ProofWindowClosed',
    NODE_NOT_AWARDED: 'NodeNotAwarded',
    WRONG_MERKLE_PROOF: 'WrongMerkleProof',
    NO_MINTED_ASSETS: 'NoMintedAssets',
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

export const PUBLISH_STORAGE_MEMORY_CLEANUP_COMMAND_CLEANUP_TIME_MILLS = 4 * 60 * 60 * 1000;

export const PUBLISH_STORAGE_FILE_CLEANUP_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const FINALIZED_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const GET_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const GET_CLEANUP_TIME_DELAY = 24 * 60 * 60 * 1000;

export const GET_RESPONSE_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const GET_RESPONSE_CLEANUP_TIME_DELAY = 24 * 60 * 60 * 1000;

export const PUBLISH_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const PUBLISH_CLEANUP_TIME_DELAY = 24 * 60 * 60 * 1000;

export const PUBLISH_RESPONSE_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const PUBLISH_RESPONSE_CLEANUP_TIME_DELAY = 24 * 60 * 60 * 1000;

export const UPDATE_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const UPDATE_CLEANUP_TIME_DELAY = 24 * 60 * 60 * 1000;

export const UPDATE_RESPONSE_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const UPDATE_RESPONSE_CLEANUP_TIME_DELAY = 24 * 60 * 60 * 1000;

export const PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_DELAY = 24 * 60 * 60 * 1000;
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

export const PENDING_STORAGE_FILES_FOR_REMOVAL_MAX_NUMBER = 100;

export const OPERATION_ID_FILES_FOR_REMOVAL_MAX_NUMBER = 100;

export const REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER = 10_000;

export const ARCHIVE_COMMANDS_FOLDER = 'commands';

export const ARCHIVE_BLOCKCHAIN_EVENTS_FOLDER = 'blockchain_events';

export const ARCHIVE_GET_FOLDER = 'get';

export const ARCHIVE_GET_RESPONSES_FOLDER = 'get_responses';

export const ARCHIVE_PUBLISH_FOLDER = 'publish';

export const ARCHIVE_PUBLISH_RESPONSES_FOLDER = 'publish_responses';

export const ARCHIVE_UPDATE_FOLDER = 'update';

export const ARCHIVE_UPDATE_RESPONSES_FOLDER = 'update_responses';

/**
 * How many commands will run in parallel
 * @type {number}
 */
export const COMMAND_QUEUE_PARALLELISM = 150;

export const GET_LATEST_SERVICE_AGREEMENT_BATCH_SIZE = 50;

export const GET_ASSERTION_IDS_MAX_RETRY_COUNT = 5;

export const GET_ASSERTION_IDS_RETRY_DELAY_IN_SECONDS = 2;

export const GET_LATEST_SERVICE_AGREEMENT_EXCLUDE_LATEST_TOKEN_ID = 1;

/**
 * @constant {object} HTTP_API_ROUTES -
 *  HTTP API Routes with parameters
 */
export const HTTP_API_ROUTES = {
    v0: {
        publish: {
            method: 'post',
            path: '/publish',
            options: { rateLimit: true },
        },
        update: {
            method: 'post',
            path: '/update',
            options: { rateLimit: true },
        },
        query: {
            method: 'post',
            path: '/query',
            options: {},
        },
        'local-store': {
            method: 'post',
            path: '/local-store',
            options: {},
        },
        get: {
            method: 'post',
            path: '/get',
            options: { rateLimit: true },
        },
        result: {
            method: 'get',
            path: '/:operation/:operationId',
            options: {},
        },
        info: {
            method: 'get',
            path: '/info',
            options: {},
        },
        'bid-suggestion': {
            method: 'get',
            path: '/bid-suggestion',
            options: {},
        },
    },
    v1: {
        // get: {
        //     method: 'post',
        //     path: '/get',
        //     options: { rateLimit: true },
        // },
    },
};

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
    TRIPLE_PARANET: 'TRIPLE_PARANET',
    PENDING: 'PENDING',
};

/**
 * Contract names
 * @type {{SHARDING_TABLE_CONTRACT: string}}
 */
export const CONTRACTS = {
    CONTENT_ASSET_CONTRACT: 'ContentAssetContract',
    SHARDING_TABLE_CONTRACT: 'ShardingTableContract',
    STAKING_CONTRACT: 'StakingContract',
    PROFILE_CONTRACT: 'ProfileContract',
    HUB_CONTRACT: 'HubContract',
    CONTENT_ASSET: 'ContentAssetContract',
    COMMIT_MANAGER_V1_U1_CONTRACT: 'CommitManagerV1U1Contract',
    PARAMETERS_STORAGE_CONTRACT: 'ParametersStorageContract',
    IDENTITY_STORAGE_CONTRACT: 'IdentityStorageContract',
    LOG2PLDSF_CONTRACT: 'Log2PLDSFContract',
    LINEAR_SUM_CONTRACT: 'LinearSumContract',
    PARANETS_REGISTRY_CONTRACT: 'ParanetsRegistry',
};

export const CONTRACT_EVENTS = {
    HUB: ['NewContract', 'ContractChanged', 'NewAssetStorage', 'AssetStorageChanged'],
    SHARDING_TABLE: ['NodeAdded', 'NodeRemoved'],
    STAKING: ['StakeIncreased', 'StakeWithdrawalStarted'],
    PROFILE: ['AskUpdated'],
    CONTENT_ASSET: ['AssetMinted'],
    COMMIT_MANAGER_V1: ['StateFinalized'],
    PARAMETERS_STORAGE: ['ParameterChanged'],
    LOG2PLDSF: ['ParameterChanged'],
    LINEAR_SUM: ['ParameterChanged'],
};

export const GROUPED_CONTRACT_EVENTS = {};

export const CONTRACT_EVENT_TO_GROUP_MAPPING = (() => {
    const mapping = {};
    Object.entries(GROUPED_CONTRACT_EVENTS).forEach(([groupName, { events }]) => {
        events.forEach((eventName) => {
            mapping[eventName] = groupName;
        });
    });
    return mapping;
})();

export const NODE_ENVIRONMENTS = {
    DEVELOPMENT: 'development',
    TEST: 'test',
    DEVNET: 'devnet',
    TESTNET: 'testnet',
    MAINNET: 'mainnet',
};

export const MAXIMUM_FETCH_EVENTS_FAILED_COUNT = 1000;

export const DELAY_BETWEEN_FAILED_FETCH_EVENTS_MILLIS = 10 * 1000;

export const CONTRACT_EVENT_FETCH_INTERVALS = {
    MAINNET: 10 * 1000,
    DEVELOPMENT: 4 * 1000,
};

export const BLOCK_TIME_MILLIS = {
    OTP: 12_000,
    HARDHAT: 5_000,
    GNOSIS: 5_000,
    DEFAULT: 12_000,
    BASE: 2_000,
};

export const TRANSACTION_CONFIRMATIONS = 1;

export const SERVICE_AGREEMENT_SOURCES = {
    BLOCKCHAIN: 'blockchain',
    EVENT: 'event',
    CLIENT: 'client',
    NODE: 'node',
};

export const CACHE_DATA_TYPES = {
    NUMBER: 'number',
    ANY: 'any',
};

export const PARANET_SYNC_SOURCES = {
    SYNC: 'sync',
    LOCAL_STORE: 'local_store',
};

/**
 * CACHED_FUNCTIONS:
 * ContractName: {
 *     functionName: returnType
 * }
 * @type {{IdentityStorageContract: [{name: string, type: string}], ParametersStorageContract: *}}
 */
export const CACHED_FUNCTIONS = {
    ParametersStorageContract: {
        r0: CACHE_DATA_TYPES.NUMBER,
        r1: CACHE_DATA_TYPES.NUMBER,
        r2: CACHE_DATA_TYPES.NUMBER,
        finalizationCommitsNumber: CACHE_DATA_TYPES.NUMBER,
        updateCommitWindowDuration: CACHE_DATA_TYPES.NUMBER,
        commitWindowDurationPerc: CACHE_DATA_TYPES.NUMBER,
        proofWindowDurationPerc: CACHE_DATA_TYPES.NUMBER,
        epochLength: CACHE_DATA_TYPES.NUMBER,
        minimumStake: CACHE_DATA_TYPES.ANY,
        maximumStake: CACHE_DATA_TYPES.ANY,
        minProofWindowOffsetPerc: CACHE_DATA_TYPES.NUMBER,
        maxProofWindowOffsetPerc: CACHE_DATA_TYPES.NUMBER,
    },
    IdentityStorageContract: {
        getIdentityId: CACHE_DATA_TYPES.NUMBER,
    },
    Log2PLDSFContract: {
        getParameters: CACHE_DATA_TYPES.ANY,
    },
    LinearSumContract: {
        getParameters: CACHE_DATA_TYPES.ANY,
    },
};

export const LOW_BID_SUGGESTION = 'low';
export const MED_BID_SUGGESTION = 'med';
export const HIGH_BID_SUGGESTION = 'high';
export const ALL_BID_SUGGESTION = 'all';
export const BID_SUGGESTION_RANGE_ENUM = [
    LOW_BID_SUGGESTION,
    MED_BID_SUGGESTION,
    HIGH_BID_SUGGESTION,
    ALL_BID_SUGGESTION,
];
export const LOW_BID_SUGGESTION_OFFSET = 9;
export const MED_BID_SUGGESTION_OFFSET = 11;
export const HIGH_BID_SUGGESTION_OFFSET = 14;

export const LOCAL_INSERT_FOR_ASSET_SYNC_MAX_ATTEMPTS = 5;
export const LOCAL_INSERT_FOR_ASSET_SYNC_RETRY_DELAY = 1000;

export const LOCAL_INSERT_FOR_CURATED_PARANET_MAX_ATTEMPTS = 5;
export const LOCAL_INSERT_FOR_CURATED_PARANET_RETRY_DELAY = 1000;

export const TRIPLE_STORE_REPOSITORY = {
    DKG: 'dkg',
};
