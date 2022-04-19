exports.GS1EPCIS = 'gs1-epcis';
exports.ERC721 = 'erc721';
exports.OTTELEMETRY = 'ottelemetry';
exports.MERKLE_TREE = 'Merkle Tree';
exports.BASIC = 'Basic';
exports.DID = 'DID';

/**
 * @constant {number} MAX_FILE_SIZE
 * - Max file size for publish
 */
exports.MAX_FILE_SIZE = 2621440;

/**
 * @constant {object} SERVICE_API_RATE_LIMIT
 * - Express rate limit configuration constants
 */
exports.SERVICE_API_RATE_LIMIT = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    MAX_NUMBER: 10,
};

/**
 * @constant {object} SERVICE_API_SLOW_DOWN
 * - Express slow down configuration constants
 */
exports.SERVICE_API_SLOW_DOWN = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    DELAY_AFTER_SECONDS: 5,
    DELAY_MILLS: 3 * 1000,
};

/**
 * @constant {object} NETWORK_API_RATE_LIMIT
 * - Network (Libp2p) rate limiter configuration constants
 */
exports.NETWORK_API_RATE_LIMIT = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    MAX_NUMBER: this.SERVICE_API_RATE_LIMIT.MAX_NUMBER,
};

/**
 * @constant {object} NETWORK_API_SPAM_DETECTION
 * - Network (Libp2p) spam detection rate limiter configuration constants
 */
exports.NETWORK_API_SPAM_DETECTION = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    MAX_NUMBER: 20,
};

/**
 * @constant {object} NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES
 * - Network (Libp2p) black list time window in minutes
 */
exports.NETWORK_API_BLACK_LIST_TIME_WINDOW_MINUTES = 60;

/**
 * @constant {number} DID_PREFIX
 * - DID prefix for graph database
 */
exports.DID_PREFIX = 'did:dkg';

/**
 * @constant {number} DEFAULT_COMMAND_CLEANUP_TIME_MILLS - Command cleanup interval time
 */
exports.DEFAULT_COMMAND_CLEANUP_TIME_MILLS = 4 * 24 * 60 * 60 * 1000;

/**
 * @constant {number} HANDLER_IDS_COMMAND_CLEANUP_TIME_MILLS -
 * Export command cleanup interval time 24h
 */
exports.HANDLER_IDS_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

/**
 * @constant {Array} PERMANENT_COMMANDS - List of all permanent commands
 */
exports.PERMANENT_COMMANDS = [
    'otnodeUpdateCommand', 'sendTelemetryCommand', 'cleanerCommand',
    'handlerIdsCleanerCommand', 'keepAliveCommand',
];

/**
 * @constant {number} MAX_COMMAND_DELAY_IN_MILLS - Maximum delay for commands
 */
exports.MAX_COMMAND_DELAY_IN_MILLS = 14400 * 60 * 1000; // 10 days

/**
 * @constant {number} DEFAULT_COMMAND_REPEAT_IN_MILLS - Default repeat interval
 */
exports.DEFAULT_COMMAND_REPEAT_INTERVAL_IN_MILLS = 5000; // 5 seconds

/**
 * @constant {number} DEFAULT_COMMAND_DELAY_IN_MILLS - Delay for default commands
 */
exports.DEFAULT_COMMAND_DELAY_IN_MILLS = 60 * 1000; // 60 seconds

/**
 * @constant {number} TRIPLE_STORE_CONNECT_MAX_RETRIES
 * - Maximum retries for connecting to triple store
 */
exports.TRIPLE_STORE_CONNECT_MAX_RETRIES = 10;

/**
 * @constant {number} TRIPLE_STORE_CONNECT_RETRY_FREQUENCY
 * - Wait interval between retries for connecting to triple store
 */
exports.TRIPLE_STORE_CONNECT_RETRY_FREQUENCY = 10; // 10 seconds

/**
 * @constant {number} TRIPLE_STORE_QUEUE_LIMIT
 * - Triple store queue limit
 */
exports.TRIPLE_STORE_QUEUE_LIMIT = 5000;

/**
 * @constant {number} BLOCKCHAIN_QUEUE_LIMIT
 * - Blockchain queue limit
 */
exports.BLOCKCHAIN_QUEUE_LIMIT = 25000;

/**
 * @constant {number} RESOLVE_MAX_TIME_MILLIS
 * - Maximum time for resolve operation
 */
exports.RESOLVE_MAX_TIME_MILLIS = 15 * 1000;

/**
 * @constant {number} STORE_MAX_RETRIES
 * - Maximum number of retries
 */
exports.STORE_MAX_RETRIES = 3;

/**
 * @constant {number} STORE_BUSY_REPEAT_INTERVAL_IN_MILLS
 * - Wait interval between retries for sending store requests
 */
exports.STORE_BUSY_REPEAT_INTERVAL_IN_MILLS = 4 * 1000;

/**
 * @constant {number} BUSYNESS_LIMITS
 * - Max number of operations in triple store queue that indicate busyness
 */
exports.BUSYNESS_LIMITS = {
    HANDLE_STORE: 20,
    HANDLE_RESOLVE: 20,
    HANDLE_SEARCH_ASSERTIONS: 20,
    HANDLE_SEARCH_ENTITIES: 15,
};

/**
 * @constant {number} STORE_MIN_SUCCESS_RATE
 * - Min rate of successful responses from store queries for publish to be maked as COMPLETED
 */
exports.STORE_MIN_SUCCESS_RATE = 0.8;

/**
 * @constant {object} TRIPLE_STORE_IMPLEMENTATION -
 *  Names of available triple store implementations
 */
exports.TRIPLE_STORE_IMPLEMENTATION = {
    BLAZEGRAPH: 'Blazegraph',
    GRAPHDB: 'GraphDB',
};

/**
 * @constant {number} NETWORK_HANDLER_TIMEOUT -
 * Timeout for all handler methods for network requests
 */
exports.NETWORK_HANDLER_TIMEOUT = 120e3;

/**
 * @constant {object} NETWORK_RESPONSES -
 *  Types of known network responses
 */
exports.NETWORK_RESPONSES = {
    TRUE: true,
    FALSE: false,
    ACK: 'ack',
    BUSY: 'busy',
    BLOCKED: 'blocked',
    ERROR: 'error',
};

/**
 * @constant {object} STRINGIFIED_NETWORK_RESPONSES -
 *  Stringified types of known network responses
 */
exports.STRINGIFIED_NETWORK_RESPONSES = {
    ack: '"ack"',
    busy: '"busy"',
    blocked: '"blocked"',
    error: '"error"',
};

/**
 * @constant {object} NETWORK_PROTOCOLS -
 *  Network protocols
 */
exports.NETWORK_PROTOCOLS = {
    STORE: '/store/1.0.0',
    RESOLVE: '/resolve/1.0.0',
    SEARCH: '/search/1.0.0',
    SEARCH_RESULT: '/search/1.0.0/result',
    SEARCH_ASSERTIONS: '/search/assertions/1.0.0',
    SEARCH_ASSERTIONS_RESULT: '/search/assertions/1.0.0/result',
};

/**
 * @constant {object} SERVICE_API_ROUTES
 *  Service api routes
 */
exports.SERVICE_API_ROUTES = {
    PUBLISH: '/publish',
    PROVISION: '/provision',
    UPDATE: '/update',
    RESOLVE: '/resolve',
    SEARCH: '/entities::search',
    SEARCH_ASSERTIONS: '/assertions::search',
    QUERY: '/query',
    PROOFS: '/proofs::get',
    OPERATION_RESULT: '/:operation/result/:handler_id',
    INFO: '/info',
};

/**
 * @constant {object} ERROR_TYPE -
 *  Types of errors supported
 */
exports.ERROR_TYPE = {
    INSERT_ASSERTION_ERROR: 'InsertAssertionError',
    SUBMIT_PROOFS_ERROR: 'SubmitProofsError',
    SEND_ASSERTION_ERROR: 'SendAssertionError',
    SEND_ASSERTION_ERROR_BUSY: 'SendAssertionErrorBusy',
    SENDING_TELEMETRY_DATA_ERROR: 'SendingDataTelemetryError',
    CHECKING_UPDATE_ERROR: 'CheckingUpdateError',
    API_ERROR_400: 'ApiError400',
    API_ERROR_500: 'ApiError500',
    PUBLISH_ROUTE_ERROR: 'PublishRouteError',
    RESOLVE_ROUTE_ERROR: 'ResolveRouteError',
    SEARCH_ASSERTIONS_ROUTE_ERROR: 'SearchAssertionsRouteError',
    SEARCH_ENTITIES_ROUTE_ERROR: 'SearchEntitiesRouteError',
    QUERY_ROUTE_ERROR: 'QueryRouteError',
    PROOFS_ROUTE_ERROR: 'ProofsRouteError',
    RESULTS_ROUTE_ERROR: 'ResultsRouteError',
    NODE_INFO_ROUTE_ERROR: 'NodeInfoRouteError',
    HANDLE_STORE_ERROR: 'HandleStoreError',
    EXTRACT_METADATA_ERROR: 'ExtractMetadataError',
    TRIPLE_STORE_UNAVAILABLE_ERROR: 'TripleStoreUnavailableError',
    TRIPLE_STORE_INSERT_ERROR: 'TripleStoreInsertError',
    LIBP2P_HANDLE_MSG_ERROR: 'Libp2pHandleMessageError',
    VERIFY_ASSERTION_ERROR: 'VerifyAssertionError',
    BLOCKCHAIN_CHECK_ERROR: 'BlockchainCheckError',
    COMMAND_EXECUTOR_ERROR: 'CommandExecutorError',
    FAILED_COMMAND_ERROR: 'FailedCommandError',
    UPDATE_INITIALIZATION_ERROR: 'UpdateInitializationError',
    DATA_MODULE_INITIALIZATION_ERROR: 'DataModuleInitializationError',
    OPERATIONALDB_MODULE_INITIALIZATION_ERROR: 'OperationalDbModuleInitializationError',
    NETWORK_INITIALIZATION_ERROR: 'NetworkInitializationError',
    VALIDATION_INITIALIZATION_ERROR: 'ValidationInitializationError',
    BLOCKCHAIN_INITIALIZATION_ERROR: 'BlockchainInitializationError',
    COMMAND_EXECUTOR_INITIALIZATION_ERROR: 'CommandExecutorInitializationError',
    RPC_INITIALIZATION_ERROR: 'RpcInitializationError',
    KEEP_ALIVE_ERROR: 'KeepAliveError',
};
