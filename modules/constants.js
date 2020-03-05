/**
 * @constant {number} DEFAULT_CHALLENGE_NUMBER_OF_TESTS - Number of challenges per DH
 */
exports.DEFAULT_CHALLENGE_NUMBER_OF_TESTS = 5;

/**
 * @constant {number} DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES - Block size in bytes used for Merkle tree
 */
exports.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES = 31;


/**
 * @constant {number} DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS - Challenge response time
 */
exports.DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS = 60000;

/**
 * @constant {number} DEFAULT_REPUTATION_UPDATE_PERIOD_MILLS - Period for updating reputation table
 */
exports.DEFAULT_REPUTATION_UPDATE_PERIOD_MILLS = 24 * 60 * 60 * 1000;

/**
 * @constant {number} DEFAULT_COMMAND_CLEANUP_TIME_MILLS - Command cleanup interval time
 */
exports.DEFAULT_COMMAND_CLEANUP_TIME_MILLS = 4 * 24 * 60 * 60 * 1000;

/**
 * @constant {Array} PERMANENT_COMMANDS - List of all permanent commands
 */
exports.PERMANENT_COMMANDS = [
    'cleanerCommand', 'dcChallengesCommand', 'dhLitigationInitiatedCommand',
    'reputationUpdateCommand', 'autoupdaterCommand'];

/**
 * @constant {number} MAX_COMMAND_DELAY_IN_MILLS - Maximum delay for commands
 */
exports.MAX_COMMAND_DELAY_IN_MILLS = 14400 * 60 * 1000; // 10 days


/**
 * @constant {number} DEFAULT_COMMAND_REPEAT_IN_MILLS - Default repeat interval
 */
exports.DEFAULT_COMMAND_REPEAT_INTERVAL_IN_MILLS = 5000; // 5 seconds
/**
 *
 * @constant {number} GAS_PRICE_VALIDITY_TIME_IN_MILLS - gas price maximum validity time
 */
exports.GAS_PRICE_VALIDITY_TIME_IN_MILLS = 30 * 60 * 1000; // 30 min
/**
 *
 * @constant {number} TRAC_PRICE_IN_ETH_VALIDITY_TIME_IN_MILLS - trac price maximum validity time
 */
exports.TRAC_PRICE_IN_ETH_VALIDITY_TIME_IN_MILLS = 30 * 60 * 1000; // 30 min

/**
 *
 * @constant {number} AVERAGE_GAS_PRICE_MULTIPLIER - gas price multiplier
 */
exports.AVERAGE_GAS_PRICE_MULTIPLIER = 1.2;

/**
 *
 * @constant {number} BASE_PAYOUT_GAS - Gas used for payout
 */
exports.BASE_PAYOUT_GAS = 150000;

/**
 *
 * @constant {number} BLOCKCHAIN_RETRY_DELAY_IN_MILLS - Delay length for blockchain reading
 */
exports.BLOCKCHAIN_RETRY_DELAY_IN_MILLS = 20000;

/**
 *
 * @constant {number} ANSWER_LITIGATION_COMMAND_RETRIES - dhLitigationAnswerCommand retries
 */
exports.ANSWER_LITIGATION_COMMAND_RETRIES = 2;
