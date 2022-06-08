/**
 * @constant {number} DID_PREFIX
 * - DID prefix for graph database
 */
exports.DID_PREFIX = 'did:dkg';

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
