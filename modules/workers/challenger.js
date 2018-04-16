const readLine = require('readline');


process.once('message', ({ argument }) => {
    console.log('And the message came');
});

process.once('SIGTERM', () => process.exit(0));

if (process.platform === 'win32') {
    readLine.createInterface({
        input: process.stdin,
        output: process.stdout,
    }).on('SIGTERM', () => process.emit('SIGTERM'));
}


console.log('Child process');

function intervalFunc() {
    console.log('Cant stop me now!');
}

setInterval(intervalFunc, 1500);
