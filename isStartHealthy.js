const fs = require('fs');

// index 0 and 1 are used for node and .js file name
const fileToRead = process.argv[2];

fs.readFile(`${fileToRead}.log`, (err, data) => {
    if (err) throw err;
    if (data.indexOf('OT Node listening at https://127.0.0.1:5278') >= 0) {
        console.log('npm start is healthy!');
        process.exit(0);
    } else {
        console.log('npm start is not healthy!');
        console.log('RPC server did not start listening as expected, check npm start localy');
        process.exit(-1);
    }
});
