/* eslint-disable max-len import/no-unresolved */
const importResult = require('./../importResult.json');
const Utilities = require('./../modules/Utilities');
require('dotenv').config();

if (!Utilities.isHexStrict(importResult.data_set_id) || Utilities.isZeroHash(importResult.data_set_id)) {
    console.log('data_set_id is not OK');
    process.exit(-1);
} else {
    console.log('data_set_id is OK');
}

if (importResult.message !== 'Import success') {
    console.log('message is not OK');
    process.exit(-1);
} else {
    console.log('message is OK');
}

if (importResult.wallet === null) {
    console.log('wallet is not OK');
    process.exit(-1);
} else {
    console.log('wallet is OK');
}
