const fs = require('fs');
const ms = require('ms');
const os = require('os');
const path = require('path');
const { fork } = require('child_process');
const { EventEmitter } = require('events');
const hdkey = require('hdkey');
const kadence = require('@kadenceproject/kadence');
const argv = require('minimist')(process.argv.slice(2));

let cpus = 0;
let testNetwork = 1;
let solutionDifficulty = 20;
let identityDifficulty = 8;
const solvers = [];

/**
 * Creating child process for mining an identity
 * @param c
 * @param xprv Extended private HD key
 * @param index Child derivation index
 * @param derivationPath Derivation path
 * @param events
 * @return {*}
 */
function forkIdentityDerivationSolver(c, xprv, index, derivationPath, events) {
    console.info(`Forking derivation process ${c}`);

    const solver = fork(path.join(
        __dirname, '..', 'modules', 'network',
        'kademlia', 'workers', 'identity.js',
    ), [], {
        stdio: [0, 1, 2, 'ipc'],
        env: process.env,
    });

    solver.on('message', (msg) => {
        if (msg.error) {
            return console.error(`Derivation ${c} error, ${msg.error}`);
        }

        if (msg.attempts) {
            return events.emit('attempt');
        }
        events.emit('index', msg.index);
    });

    solver.on('error', (err) => {
        console.error(`Derivation ${c} error, ${err.message}`);
    });


    const options = {
        solutionDifficulty,
        identityDifficulty,
    };
    solver.send([xprv, index, derivationPath, options]);

    return solver;
}

/**
 * Creates child processes to mine an identity
 * @param xprivkey Extended HD private key
 * @param path Child derivation path
 * @param events
 * @return {Promise<any>}
 */
async function spawnIdentityDerivationProcesses(xprivkey, path, events) {
    // How many process can we run
    if (cpus === 0) {
        cpus = os.cpus().length;
        console.info(`Using ${cpus} cores for derivation.`);
    }
    if (os.cpus().length < cpus) {
        console.error('Refusing to start more solvers than cpu cores');
        return;
    }

    for (let c = 0; c < cpus; c += 1) {
        const index = Math.floor(kadence.constants.MAX_NODE_INDEX / cpus) * c;
        const solver = forkIdentityDerivationSolver(c, xprivkey, index, path, events);

        solvers.push(solver);

        solver.once('exit', (code) => {
            if (code === 0) {
                console.info(`Derivation solver ${c} exited normally`);
            } else {
                console.error(`Derivation solver ${c} exited with code ${code}`);
            }
        });
    }

    return new Promise((resolve, reject) => {
        events.once('index', (i) => {
            events.removeAllListeners();
            // this.solvers.forEach(s => s.kill('SIGTERM'));
            resolve(i);
        });
    });
}

async function solveIdentity(xprivkey, path) {
    const events = new EventEmitter();
    const start = Date.now();
    let time;
    let attempts = 0;
    const status = setInterval(() => {
        console.trace('Still solving identity, ' +
            `currently ${attempts} of ${kadence.constants.MAX_NODE_INDEX} ` +
            `possible indices tested in the last ${ms(Date.now() - start)}`);
    }, 60000);

    console.info(`Solving identity derivation index with ${cpus} ` +
        'solver processes, this can take a while...');

    events.on('attempt', () => attempts += 1);

    let childIndex;
    try {
        childIndex = await spawnIdentityDerivationProcesses(xprivkey, path, events);
        time = Date.now() - start;
    } catch (err) {
        console.error(err.message.toLowerCase());
        process.abort();
    }

    events.removeAllListeners();
    clearInterval(status);

    console.info(`Solved identity derivation index ${childIndex} in ${ms(time)}`);
    return [xprivkey, childIndex];
}


if (argv.cpus) {
    cpus = argv.cpus;
}
if (argv.identityDifficulty) {
    identityDifficulty = argv.identityDifficulty;
}

if (argv.solutionDifficulty) {
    solutionDifficulty = argv.solutionDifficulty;
}

async function main() {
    const xprivkey = kadence.utils.toHDKeyFromSeed().privateExtendedKey;
    const [, childIndex] = await solveIdentity(
        xprivkey,
        kadence.constants.HD_KEY_DERIVATION_PATH,
    );

    const parentKey = hdkey.fromExtendedKey(xprivkey);
    const childKey = parentKey
        .derive(kadence.constants.HD_KEY_DERIVATION_PATH)
        .deriveChild(childIndex);

    console.info(JSON.stringify({
        [kadence.utils.toPublicKeyHash(childKey.publicKey).toString('hex')]: {
            xprivkey,
            index: childIndex,
        },
    }, null, 4));
}

main();
