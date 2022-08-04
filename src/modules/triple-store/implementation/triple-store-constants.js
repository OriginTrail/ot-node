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

/**
 * Triple store media types
 * @type {{APPLICATION_JSON: string, N_QUADS: string, SPARQL_RESULTS_JSON: string, LD_JSON: string}}
 */
exports.MEDIA_TYPES = {
    LD_JSON: 'application/ld+json',
    N_QUADS: 'application/n-quads',
    SPARQL_RESULTS_JSON: 'application/sparql-results+json',
};

/**
 * XML data types
 * @type {{FLOAT: string, DECIMAL: string, DOUBLE: string, BOOLEAN: string, INTEGER: string}}
 */
exports.XML_DATA_TYPES = {
    DECIMAL: 'http://www.w3.org/2001/XMLSchema#decimal',
    FLOAT: 'http://www.w3.org/2001/XMLSchema#float',
    DOUBLE: 'http://www.w3.org/2001/XMLSchema#double',
    INTEGER: 'http://www.w3.org/2001/XMLSchema#integer',
    BOOLEAN: 'http://www.w3.org/2001/XMLSchema#boolean',
};
