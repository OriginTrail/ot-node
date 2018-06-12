const fs = require('fs');
const Utilities = require('./modules/Utilities');

// index 0 and 1 are used for node and .js file name
const fileToRead = process.argv[2];
const log = Utilities.getLogger();

fs.readFile(`${fileToRead}.log`, (err, data) => {
    if (err) throw err;
    if (data.indexOf('OT Node listening at https://127.0.0.1:5278') >= 0) {
        log.info('npm start is healthy!');
        process.exit(0);
    } else {
        log.warn('npm start is not healthy!');
        log.warn('RPC server did not start listening as expected, check npm start localy');
        process.exit(-1);
    }
});
