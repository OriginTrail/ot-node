exports.GS1EPCIS = 'gs1-epcis';
exports.ERC721 = 'erc721';
exports.OTTELEMETRY = 'ottelemetry';
exports.MERKLE_TREE = 'Merkle Tree';
exports.BASIC = 'Basic';
exports.DID = 'DID';
exports.SCHEMA_CONTEXT = 'http://schema.org/';

/**
 * @constant {object} PUBLISH_TYPES
 * - Different types of publish
 */
exports.PUBLISH_TYPES = { ASSERTION: 'assertion', ASSET: 'asset', INDEX: 'index' };

/**
 * @constant {number} MIN_NODE_VERSION
 * - Required node.js version to run the ot-node
 */
exports.MIN_NODE_VERSION = 16;

/**
 * @constant {number} MAX_FILE_SIZE
 * - Max file size for publish
 */
exports.MAX_FILE_SIZE = 2621440;

// TODO retrieve from the blockchain
/**
 * @constant {number} INIT_STAKE_AMOUNT
 * - Initial stake amount for profile creation
 */
exports.INIT_STAKE_AMOUNT = 3000;

/**
 * @constant {object} NETWORK_API_RATE_LIMIT
 * - Network (Libp2p) rate limiter configuration constants
 */
exports.NETWORK_API_RATE_LIMIT = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    MAX_NUMBER: 20,
};

/**
 * @constant {object} NETWORK_API_SPAM_DETECTION
 * - Network (Libp2p) spam detection rate limiter configuration constants
 */
exports.NETWORK_API_SPAM_DETECTION = {
    TIME_WINDOW_MILLS: 1 * 60 * 1000,
    MAX_NUMBER: 40,
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
 * @constant {number} REMOVE_SESSION_COMMAND_DELAY - Remove session comand delay
 */
exports.REMOVE_SESSION_COMMAND_DELAY = 2 * 60 * 1000;

/**
 * @constant {number} OPERATION_IDS_COMMAND_CLEANUP_TIME_MILLS -
 * Export command cleanup interval time 24h
 */
exports.OPERATION_IDS_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

/**
 * @constant {Array} PERMANENT_COMMANDS - List of all permanent commands
 */
exports.PERMANENT_COMMANDS = [
    'otnodeUpdateCommand',
    // 'testCommand',
    'sendTelemetryCommand',
    // 'cleanerCommand',
    // 'operationIdsCleanerCommand',
    // 'keepAliveCommand',
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
 * @constant {number} GET_MAX_TIME_MILLIS
 * - Maximum time for get operation
 */
exports.GET_MAX_TIME_MILLIS = 15 * 1000;

/**
 * @constant {number} STORE_MAX_RETRIES
 * - Maximum number of retries
 */
exports.STORE_MAX_TRIES = 3;

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
    HANDLE_GET: 20,
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
    FUSEKI: 'Fuseki',
};

/**
 * @constant {number} NETWORK_MESSAGE_TYPES -
 * Network message types
 */
exports.NETWORK_MESSAGE_TYPES = {
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

/**
 * @constant {number} MAX_OPEN_SESSIONS -
 * Max number of open sessions
 */
exports.MAX_OPEN_SESSIONS = 10;

/**
 * @constant {number} NETWORK_HANDLER_TIMEOUT -
 * Timeout for all handler methods for network requests
 */
exports.NETWORK_HANDLER_TIMEOUT = 120e3;

/**
 * @constant {object} NETWORK_PROTOCOLS -
 *  Network protocols
 */
exports.NETWORK_PROTOCOLS = {
    STORE: '/store/1.0.1',
    GET: '/get/1.0.1',
    SEARCH: '/search/1.0.1',
    SEARCH_RESULT: '/search/1.0.1/result',
};

/**
 * @constant {object} SERVICE_API_ROUTES
 *  Service api routes
 */
exports.SERVICE_API_ROUTES = {
    PUBLISH: '/publish',
    GET: '/get',
    SEARCH: '/search',
    QUERY: '/query',
    OPERATION_RESULT: '/:operation/:operation_id',
    INFO: '/info',
};

/**
 * @constant {object} ERROR_TYPE -
 *  Types of errors supported
 */
exports.ERROR_TYPE = {
    PUBLISH: {
        PUBLISH_START_ERROR: 'PublishStartError',
        PUBLISH_ROUTE_ERROR: 'PublishRouteError',
        PUBLISH_VALIDATE_ASSERTION_ERROR: 'PublishValidateAssertionError',
        PUBLISH_VALIDATE_ASSERTION_REMOTE_ERROR: 'PublishValidateAssertionRemoteError',
        PUBLISH_LOCAL_STORE_ERROR: 'PublishLocalStoreError',
        PUBLISH_LOCAL_STORE_REMOTE_ERROR: 'PublishLocalStoreRemoteError',
        PUBLISH_FIND_NODES_ERROR: 'PublishFindNodesError',
        PUBLISH_STORE_INIT_ERROR: 'PublishStoreInitError',
        PUBLISH_STORE_REQUEST_ERROR: 'PublishStoreRequestError',
        PUBLISH_ERROR: 'PublishError',
        PUBLISH_REMOTE_ERROR: 'PublishRemoteError',
    },
    GET: {
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
    SEARCH: {
        SEARCH_ROUTE_ERROR: 'SearchRouteError',
        SEARCH_INIT_ERROR: 'SearchInitError',
        SEARCH_REQUEST_ERROR: 'SearchRequestError',
        HANDLE_SEARCH_INIT_ERROR: 'HandleSearchInitError',
        HANDLE_SEARCH_REQUEST_ERROR: 'HandleSearchRequestError',
        NETWORK_SEARCH_ERROR: 'NetworkSearchError',
        SEARCH_SCHEDULE_MESSAGES_COMMAND: 'SearchScheduleMessagesCommand',
        SEARCH_ERROR: 'SearchError',
    },
    INSERT_ASSERTION_ERROR: 'InsertAssertionError',
    PREPARE_ASSERTION_ERROR: 'PrepareAssertionError',
    VALIDATE_ASSERTION_ERROR: 'ValidateAssertionError',
    SUBMIT_PROOFS_ERROR: 'SubmitProofsError',
    FIND_NODES_ERROR: 'FindNodesError',
    SEND_ASSERTION_ERROR: 'SendAssertionError',
    SEND_ASSERTION_ERROR_BUSY: 'SendAssertionErrorBusy',
    SENDING_TELEMETRY_DATA_ERROR: 'SendingDataTelemetryError',
    CHECKING_UPDATE_ERROR: 'CheckingUpdateError',
    API_ERROR_400: 'ApiError400',
    API_ERROR_500: 'ApiError500',
    QUERY_ROUTE_ERROR: 'QueryRouteError',
    PROOFS_ROUTE_ERROR: 'ProofsRouteError',
    RESULTS_ROUTE_ERROR: 'ResultsRouteError',
    NODE_INFO_ROUTE_ERROR: 'NodeInfoRouteError',
    STORE_INIT_ERROR: 'StoreInitError',
    STORE_REQUEST_ERROR: 'StoreRequestError',
    GET_ASSERTION_COMMAND: 'GetAssertionCommand',
    GET_START_ERROR: 'GetStartError',
    GET_INIT_ERROR: 'GetInitError',
    GET_REQUEST_ERROR: 'GetRequestError',
    LOCAL_GET_ERROR: 'LocalGetError',
    LOCAL_STORE_ERROR: 'LocalStoreError',
    HANDLE_STORE_ERROR: 'HandleStoreError',
    HANDLE_STORE_INIT_ERROR: 'HandleStoreInitError',
    HANDLE_STORE_REQUEST_ERROR: 'HandleStoreRequestError',
    HANDLE_GET_INIT_ERROR: 'HandleGetInitError',
    HANDLE_GET_REQUEST_ERROR: 'HandleGetRequestError',
    EXTRACT_METADATA_ERROR: 'ExtractMetadataError',
    TRIPLE_STORE_UNAVAILABLE_ERROR: 'TripleStoreUnavailableError',
    TRIPLE_STORE_INSERT_ERROR: 'TripleStoreInsertError',
    LIBP2P_HANDLE_MSG_ERROR: 'Libp2pHandleMessageError',
    VERIFY_ASSERTION_ERROR: 'VerifyAssertionError',
    BLOCKCHAIN_CHECK_ERROR: 'BlockchainCheckError',
    COMMAND_EXECUTOR_ERROR: 'CommandExecutorError',
    FAILED_COMMAND_ERROR: 'FailedCommandError',
    MODULE_INITIALIZATION_ERROR: 'ModuleInitializationError',
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
/**
 * @constant {object} OPERATION_ID_STATUS -
 *  Possible statuses for operation id
 */
exports.OPERATION_ID_STATUS = {
    PENDING: 'PENDING',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
    SEARCHING_FOR_NODES: 'SEARCHING_FOR_NODES',
    FIND_NODES_START: 'FIND_NODES_START',
    FIND_NODES_END: 'FIND_NODES_END',
    PUBLISH: {
        VALIDATING_ASSERTION_START: 'VALIDATING_ASSERTION_START',
        VALIDATING_ASSERTION_END: 'VALIDATING_ASSERTION_END',
        VALIDATING_ASSERTION_REMOTE_START: 'VALIDATING_ASSERTION_REMOTE_START',
        VALIDATING_ASSERTION_REMOTE_END: 'VALIDATING_ASSERTION_REMOTE_END',
        VALIDATING_ASSERTION_STAKE_START: 'VALIDATING_ASSERTION_STAKE_START',
        VALIDATING_ASSERTION_STAKE_END: 'VALIDATING_ASSERTION_STAKE_END',
        INSERTING_ASSERTION: 'INSERTING_ASSERTION',
        PUBLISHING_ASSERTION: 'PUBLISHING_ASSERTION',
        PUBLISH_START: 'PUBLISH_START',
        PUBLISH_INIT_START: 'PUBLISH_INIT_START',
        PUBLISH_INIT_END: 'PUBLISH_INIT_END',
        PUBLISH_PREP_ARGS_START: '',
        PUBLISH_PREP_ARGS_END: '',
        PUBLISH_CANONIZATION_START: '',
        PUBLISH_CANONIZATION_END: '',
        PUBLISH_GENERATE_METADATA_START: 'PUBLISH_GENERATE_METADATA_START',
        PUBLISH_GENERATE_METADATA_END: 'PUBLISH_GENERATE_METADATA_END',
        PUBLISH_BLOCKCHAIN_START: 'PUBLISH_BLOCKCHAIN_START',
        PUBLISH_BLOCKCHAIN_END: 'PUBLISH_BLOCKCHAIN_END',
        PUBLISH_LOCAL_STORE_START: 'PUBLISH_LOCAL_STORE_START',
        PUBLISH_LOCAL_STORE_END: 'PUBLISH_LOCAL_STORE_END',
        PUBLISH_REPLICATE_START: 'PUBLISH_REPLICATE_START',
        PUBLISH_REPLICATE_END: 'PUBLISH_REPLICATE_END',
        PUBLISH_END: 'PUBLISH_END',
    },
    GET: {
        ASSERTION_EXISTS_LOCAL_START: 'ASSERTION_EXISTS_LOCAL_START',
        ASSERTION_EXISTS_LOCAL_END: 'ASSERTION_EXISTS_LOCAL_END',
        GET_ASSERTION: 'GET_ASSERTION',
        GET_START: 'GET_START',
        GET_INIT_START: 'GET_INIT_START',
        GET_INIT_END: 'GET_INIT_END',
        GET_LOCAL_START: 'GET_LOCAL_START',
        GET_LOCAL_END: 'GET_LOCAL_END',
        GET_REMOTE_START: 'GET_REMOTE_START',
        GET_REMOTE_END: 'GET_REMOTE_END',
        GET_FETCH_FROM_NODES_START: 'GET_FETCH_FROM_NODES_START',
        GET_FETCH_FROM_NODES_END: 'GET_FETCH_FROM_NODES_START',
        GET_CREATE_ASSERTION_START: '',
        GET_CREATE_ASSERTION_END: '',
        GET_VERIFY_ASSERTION_START: '',
        GET_VERIFY_ASSERTION_END: '',
        GET_SAVE_ASSERTION_START: '',
        GET_SAVE_ASSERTION_END: '',
        GET_END: 'GET_END',
    },
    SEARCH: {
        SEARCH_START: 'SEARCH_START',
    },
};

/**
 * @constant {object} PUBLISH_STATUS -
 *  Possible statuses for publish procedure
 */
exports.PUBLISH_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};

/**
 * @constant {object} PUBLISH_STATUS -
 *  Possible statuses for publish procedure
 */
exports.PUBLISH_REQUEST_STATUS = {
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};

/**
 * @constant {object} GET_STATUS -
 *  Possible statuses for get procedure
 */
exports.GET_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};

/**
 * @constant {object} GET_REQUEST_STATUS -
 *  Possible statuses for get request
 */
exports.GET_REQUEST_STATUS = {
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};

/**
 * @constant {object} SEARCH_STATUS -
 *  Possible statuses for search procedure
 */
exports.SEARCH_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};

/**
 * @constant {object} SEARCH_REQUEST_STATUS -
 *  Possible statuses for search request
 */
exports.SEARCH_REQUEST_STATUS = {
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};
