const kadence = require('@kadenceproject/kadence');
const readLine = require('readline');

process.once('message', ([xprv, index, path, options]) => {
    if (options && options.solutionDifficulty && options.identityDifficulty) {
        kadence.constants.SOLUTION_DIFFICULTY = options.solutionDifficulty;
        kadence.constants.IDENTITY_DIFFICULTY = options.identityDifficulty;
    }

    const identity = new kadence.eclipse.EclipseIdentity(xprv, index, path);

    let attempts = 0;
    const start = Date.now();

    identity.on('index', () => {
        attempts += 1;
        process.send({ attempts });
    });

    identity.solve()
        .then((result) => {
            process.send({ index: result, time: Date.now() - start });
            process.exit(0);
        })
        .catch((err) => {
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
