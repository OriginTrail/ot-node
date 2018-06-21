const readLine = require('readline');
const log = require('../Utilities').getLogger();


process.once('message', ({ argument }) => {
    log.info('And the message came');
});

process.once('SIGTERM', () => process.exit(0));

if (process.platform === 'win32') {
    readLine.createInterface({
        input: process.stdin,
        output: process.stdout,
    }).on('SIGTERM', () => process.emit('SIGTERM'));
}


log.info('Child process');

function intervalFunc() {
    log.info('Cant stop me now!');
}

setInterval(intervalFunc, 1500);
