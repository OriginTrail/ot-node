const kadence = require('@kadenceproject/kadence');
const readLine = require('readline');

if (parseInt(process.env.kadence_TestNetworkEnabled, 10)) {
    kadence.constants.SOLUTION_DIFFICULTY = kadence.constants.TESTNET_DIFFICULTY;
    kadence.constants.IDENTITY_DIFFICULTY = kadence.constants.TESTNET_DIFFICULTY;
}

process.once('message', ({ privateKey }) => {
    const solver = new kadence.permission.PermissionSolver(Buffer.from(privateKey, 'hex'));

    solver.on('data', (data) => {
        data.solution = data.solution.toBuffer().toString('hex');
        process.send({ result: data });
        // process.exit(0);
    });

    solver.on('error', (err) => {
        process.send({ error: err.message });
        process.exit(1);
    });
});

process.once('SIGTERM', () => process.exit(0));

if (process.platform === 'win32') {
    readLine.createInterface({
        input: process.stdin,
        output: process.stdout,
    }).on('SIGTERM', () => process.emit('SIGTERM'));
}
