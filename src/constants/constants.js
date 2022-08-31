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
 * @constant {number} HIGH_TRAFFIC_EVENTS_NUMBER_PER_HOUR - Maximum expected number of events per hour
 */
exports.HIGH_TRAFFIC_OPERATIONS_NUMBER_PER_HOUR = 16000;

/**
 * @constant {number} SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES
 * - Interval between sending of telemetry events
 */
exports.SEND_TELEMETRY_COMMAND_FREQUENCY_MINUTES = 15;

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
    'sendTelemetryCommand',
    'operationIdCleanerCommand',
    'commandsCleanerCommand',
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
 * @constant {number} WEBSOCKET_PROVIDER_OPTIONS
 * - Websocket provider options
 */
module.exports.WEBSOCKET_PROVIDER_OPTIONS = {
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
    QUERY: {
        LOCAL_QUERY_ERROR: 'LocalQueryError',
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
    FIND_NODES_START: 'FIND_NODES_START',
    FIND_NODES_END: 'FIND_NODES_END',
    PUBLISH: {
        VALIDATING_ASSERTION_START: 'VALIDATING_ASSERTION_START',
        VALIDATING_ASSERTION_END: 'VALIDATING_ASSERTION_END',
        VALIDATING_ASSERTION_REMOTE_START: 'VALIDATING_ASSERTION_REMOTE_START',
        VALIDATING_ASSERTION_REMOTE_END: 'VALIDATING_ASSERTION_REMOTE_END',
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
        GET_FETCH_FROM_NODES_END: 'GET_FETCH_FROM_NODES_START',
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

    QUERY: {
        QUERY_INIT_START: 'QUERY_INIT_START',
        QUERY_INIT_END: 'QUERY_INIT_END',
        QUERY_START: 'QUERY_START',
        QUERY_END: 'QUERY_END',
    },
};

/**
 * @constant {object} OPERATIONS -
 *  Operations
 */
exports.OPERATIONS = {
    PUBLISH: 'publish',
    GET: 'get',
    SEARCH: 'search',
};

/**
 * @constant {number} OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS -
 * operation id command cleanup interval time 24h
 */
exports.OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;
/**
 * @constant {number} FINALIZED_COMMAND_CLEANUP_TIME_MILLS - Command cleanup interval time
 * finalized commands command cleanup interval time 24h
 */
exports.FINALIZED_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;
/**
 * @constant {number} COMMAND_STATUS -
 * Status for commands
 */
exports.COMMAND_STATUS = {
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    STARTED: 'STARTED',
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    REPEATING: 'REPEATING',
};

/**
 * @constant {object} NETWORK_PROTOCOLS -
 *  Network protocols
 */
exports.NETWORK_PROTOCOLS = {
    STORE: '/store/1.0.0',
    GET: '/get/1.0.0',
    SEARCH: '/search/1.0.0',
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
 * Local query types
 * @type {{CONSTRUCT: string, SELECT: string}}
 */
exports.QUERY_TYPES = {
    SELECT: 'SELECT',
    CONSTRUCT: 'CONSTRUCT',
};
