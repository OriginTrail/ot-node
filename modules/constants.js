/**
 * @constant {number} DEFAULT_CHALLENGE_NUMBER_OF_TESTS - Number of challenges per DH
 */
exports.DEFAULT_CHALLENGE_NUMBER_OF_TESTS = 10;

/**
 * @constant {number} DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES - Block size in bytes used for Merkle tree
 */
exports.DEFAULT_CHALLENGE_BLOCK_SIZE_BYTES = 32;


/**
 * @constant {number} DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS - Challenge response time
 */
exports.DEFAULT_CHALLENGE_RESPONSE_TIME_MILLS = 5000;

/**
 * @constant {number} DEFAULT_COMMAND_CLEANUP_TIME_MILLS - Command cleanup interval time
 */
exports.DEFAULT_COMMAND_CLEANUP_TIME_MILLS = 4 * 24 * 60 * 60 * 1000;

/**
 * @constant {Array} PERMANENT_COMMANDS - List of all permanent commands
 */
exports.PERMANENT_COMMANDS = ['cleanerCommand', 'dcChallengesCommand', 'dhLitigationInitiatedCommand', 'dhReplacementStartedCommand'];

/**
 * @constant {number} MAX_COMMAND_DELAY_IN_MILLS - Maximum delay for commands
 */
exports.MAX_COMMAND_DELAY_IN_MILLS = 14400 * 60 * 1000; // 10 days


/**
 * @constant {number} DEFAULT_COMMAND_REPEAT_IN_MILLS - Default repeat interval
 */
exports.DEFAULT_COMMAND_REPEAT_INTERVAL_IN_MILLS = 5000; // 5 seconds
