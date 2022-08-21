exports.SCHEMA_CONTEXT = 'http://schema.org/';

/**
 * @constant {number} MAX_FILE_SIZE
 * - Max file size for publish
 */
module.exports.MAX_FILE_SIZE = 2621440;

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

// TODO retrieve from the blockchain
/**
 * @constant {number} INIT_STAKE_AMOUNT
 * - Initial stake amount for profile creation
 */
exports.INIT_STAKE_AMOUNT = 3000;

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
exports.PERMANENT_COMMANDS = ['otnodeUpdateCommand', 'sendTelemetryCommand'];

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
    SEARCH_ASSERTIONS: {
        VALIDATING_QUERY: 'VALIDATING_QUERY',
        SEARCHING_ASSERTIONS: 'SEARCHING_ASSERTIONS',
        FAILED: 'FAILED',
        COMPLETED: 'COMPLETED',
        SEARCH_START: 'SEARCH_START',
        SEARCH_END: 'SEARCH_END',
    },
    SEARCH_ENTITIES: {
        VALIDATING_QUERY: 'VALIDATING_QUERY',
        SEARCHING_ENTITIES: 'SEARCHING_ENTITIES',
    },
};

/**
 * @constant {object} NETWORK_PROTOCOLS -
 *  Network protocols
 */
exports.NETWORK_PROTOCOLS = {
    STORE: '/store/1.0.0',
    GET: '/get/1.0.0',
    SEARCH: '/search/1.0.0',
    SEARCH_RESULT: '/search/1.0.0/result',
    SEARCH_ASSERTIONS: '/search/assertions/1.0.0',
    SEARCH_ASSERTIONS_RESULT: '/search/assertions/1.0.0/result',
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
 * @constant {object} GET_STATUS -
 *  Possible statuses for get procedure
 */
exports.GET_STATUS = {
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
 * @constant {object} GET_REQUEST_STATUS -
 *  Possible statuses for get request
 */
exports.GET_REQUEST_STATUS = {
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
};

/**
 * @constant {object} PUBLISH_METHOD -
 *  Possible methods for publish
 */
exports.PUBLISH_METHOD = {
    PUBLISH: 'PUBLISH',
    PROVISION: 'PROVISION',
    UPDATE: 'UPDATE',
};
