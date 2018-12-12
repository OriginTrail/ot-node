const enumify = require('enumify');

/**
 * OfferStatus enumeration
 */
class OfferStatus extends enumify.Enum {}
OfferStatus.initEnum([
    'PENDING',
    'STARTED',
    'CHOOSING',
    'FAILED',
    'FINALIZED',
    'PREPARED',
    'PUBLISHED',
    'MINED']);