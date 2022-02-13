exports.GS1EPCIS = 'gs1-epcis';
exports.NFT = 'nft';
exports.MERKLE_TREE = 'Merkle Tree';
exports.BASIC = 'Basic';
exports.DID = 'DID';

/**
 * @constant {number} MAX_FILE_SIZE
 * - Max file size for publish
 */
exports.MAX_FILE_SIZE = 26214400;

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
    'handlerIdsCleanerCommand',
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
 * @constant {object} TRIPLE_STORE_IMPLEMENTATION -
 *  Names of available triple store implementations
 */
exports.TRIPLE_STORE_IMPLEMENTATION = {
    BLAZEGRAPH: 'Blazegraph',
    GRAPHDB: 'GraphDB',
};

/**
 * @constant {object} ERROR_TYPE -
 *  Types of errors supported
 */
exports.ERROR_TYPE = {
    INSERT_ASSERTION_ERROR: 'InsertAssertionError',
    SUBMIT_PROOFS_ERROR: 'SubmitProofsError',
    SEND_ASSERTION_ERROR: 'SendAssertionError',
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
    EXTRACT_METADATA_ERROR: 'ExtractMetadataError',
    TRIPLE_STORE_UNAVAILABLE_ERROR: 'TripleStoreUnavailableError',
    LIBP2P_HANDLE_MSG_ERROR: 'Libp2pHandleMessageError',
    VERIFY_ASSERTION_ERROR: 'VerifyAssertionError',
    BLOCKCHAIN_CHECK_ERROR: 'BlockchainCheckError',
    COMMAND_EXECUTOR_ERROR: 'CommandExecutorError',
    FAILED_COMMAND_ERROR: 'FailedCommandError',
    UPDATE_INITIALIZATION_ERROR: 'UpdateInitializationError',
    DATA_MODULE_INITIALIZATION_ERROR: 'DataModuleInitializationError',
    NETWORK_INITIALIZATION_ERROR: 'NetworkInitializationError',
    VALIDATION_INITIALIZATION_ERROR: 'ValidationInitializationError',
    BLOCKCHAIN_INITIALIZATION_ERROR: 'BlockchainInitializationError',
    COMMAND_EXECUTOR_INITIALIZATION_ERROR: 'CommandExecutorInitializationError',
    RPC_INITIALIZATION_ERROR: 'RpcInitializationError',
};
