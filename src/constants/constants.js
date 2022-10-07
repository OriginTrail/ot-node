export const SCHEMA_CONTEXT = 'http://schema.org/';

export const TRIPLE_STORE_CONNECT_MAX_RETRIES = 10;

export const TRIPLE_STORE_CONNECT_RETRY_FREQUENCY = 10;

export const MAX_FILE_SIZE = 2621440;

export const PUBLISH_TYPES = { ASSERTION: 'assertion', ASSET: 'asset', INDEX: 'index' };

export const DHT_TYPES = { DUAL: 'dual', WAN: 'wan', LAN: 'lan' };

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

export const INIT_STAKE_AMOUNT = 3000;

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

export const DEFAULT_COMMAND_CLEANUP_TIME_MILLS = 4 * 24 * 60 * 60 * 1000;

export const REMOVE_SESSION_COMMAND_DELAY = 2 * 60 * 1000;

export const OPERATION_IDS_COMMAND_CLEANUP_TIME_MILLS = 24 * 60 * 60 * 1000;

export const PERMANENT_COMMANDS = [
    'otnodeUpdateCommand',
    'sendTelemetryCommand',
    'operationIdCleanerCommand',
    'commandsCleanerCommand',
];

export const MAX_COMMAND_DELAY_IN_MILLS = 14400 * 60 * 1000; // 10 days

export const DEFAULT_COMMAND_REPEAT_INTERVAL_IN_MILLS = 5000; // 5 seconds

export const DEFAULT_COMMAND_DELAY_IN_MILLS = 60 * 1000; // 60 seconds

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

export const MAX_OPEN_SESSIONS = 10;

export const ERROR_TYPE = {
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
export const OPERATION_ID_STATUS = {
    PENDING: 'PENDING',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
    FIND_NODES_START: 'FIND_NODES_START',
    FIND_NODES_END: 'FIND_NODES_END',
    FIND_NODES_LOCAL_START: 'FIND_NODES_LOCAL_START',
    FIND_NODES_LOCAL_END: 'FIND_NODES_LOCAL_END',
    FIND_NODES_OPEN_CONNECTION_START: 'FIND_NODES_OPEN_CONNECTION_START',
    FIND_NODES_OPEN_CONNECTION_END: 'FIND_NODES_OPEN_CONNECTION_END',
    FIND_NODES_CREATE_STREAM_START: 'FIND_NODES_CREATE_STREAM_START',
    FIND_NODES_CREATE_STREAM_END: 'FIND_NODES_CREATE_STREAM_END',
    FIND_NODES_SEND_MESSAGE_START: 'FIND_NODES_SEND_MESSAGE_START',
    FIND_NODES_SEND_MESSAGE_END: 'FIND_NODES_SEND_MESSAGE_END',
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
        GET_FETCH_FROM_NODES_END: 'GET_FETCH_FROM_NODES_END',
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

export const OPERATIONS = {
    PUBLISH: 'publish',
    GET: 'get',
    SEARCH: 'search',
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
/**
 * @constant {number} COMMAND_STATUS -
 * Status for commands
 */
export const COMMAND_STATUS = {
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
export const NETWORK_PROTOCOLS = {
    STORE: ['/store/1.0.1', '/store/1.0.0'],
    GET: ['/get/1.0.0'],
};

export const OPERATION_STATUS = {
    IN_PROGRESS: 'IN_PROGRESS',
    FAILED: 'FAILED',
    COMPLETED: 'COMPLETED',
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
