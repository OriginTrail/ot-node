const fs = require('fs');
const ms = require('ms');
const os = require('os');
const path = require('path');
const assert = require('assert');
const boscar = require('boscar');
const hdkey = require('hdkey');
const deasync = require('deasync-promise');
const utilities = require('./Utilities');
const log = require('./Utilities').getLogger();
const config = require('./Config');
const node = require('./Node');
const kadence = require('@kadenceproject/kadence');
const { EventEmitter } = require('events');
const { fork } = require('child_process');

class NetworkUtilities {
    constructor() {
        this.solvers = [];
    }

    /**
    * Checks existence of SSL certificate and if not, generates one
    * @return {Promise<boolean>}
    */
    async setSelfSignedCertificate() {
        if (!fs.existsSync(`../keys/${config.ssl_key_path}`)) {
            const result = await utilities.generateSelfSignedCertificate(config);
            if (result) {
                log.info('SSL generated');
                return true;
            }
        }
        log.info('SSL checked successfully');
        return true;
    }

    /**
    * Mining a new identity
    * @return {Promise<void>}
    */
    async solveIdentity() {
        const events = new EventEmitter();
        const start = Date.now();
        let time;
        let attempts = 0;
        const status = setInterval(() => {
            log.info('Still solving identity, ' +
          `currently ${attempts} of ${kadence.constants.MAX_NODE_INDEX} ` +
          `possible indices tested in the last ${ms(Date.now() - start)}`);
        }, 60000);

        log.info(`Solving identity derivation index with ${config.cpus} ` +
        'solver processes, this can take a while...');

        events.on('attempt', () => attempts += 1);

        try {
            this.index = await this.spawnIdentityDerivationProcesses(this.xprivkey, events);
            time = Date.now() - start;
        } catch (err) {
            log.error(err.message.toLowerCase());
            log.info(`Delete/move ${config.private_extended_key_path} and restart`);
            process.exit(1);
        }

        events.removeAllListeners();
        clearInterval(status);

        log.info(`Solved identity derivation index ${this.index} in ${ms(time)}`);
        utilities.saveToConfig('child_derivation_index', this.index);
        config.child_derivation_index = this.index;
    }

    /**
    * Creates child processes to mine an identity
    * @param xprivkey
    * @param events
    * @return {Promise<any>}
    */
    async spawnIdentityDerivationProcesses(xprivkey, events) {
        // How many process can we run
        const cpus = parseInt(config.cpus, 10);

        if (cpus === 0) {
            return log.info('There are no derivation processes running');
        }
        if (os.cpus().length < cpus) {
            return log.error('Refusing to start more solvers than cpu cores');
        }

        for (let c = 0; c < cpus; c += 1) {
            const index = Math.floor(kadence.constants.MAX_NODE_INDEX / cpus) * c;
            const solver = this.forkIdentityDerivationSolver(c, xprivkey, index, events);

            this.solvers.push(solver);

            solver.once('exit', (code) => {
                if (code === 0) {
                    log.info(`Derivation solver ${c} exited normally`);
                } else {
                    log.error(`Derivation solver ${c} exited with code ${code}`);
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

    /**
    * Creating child process for mining an identity
    * @param c
    * @param xprv
    * @param index
    * @param events
    * @return {*}
    */
    forkIdentityDerivationSolver(c, xprv, index, events) {
        log.info(`Forking derivation process ${c}`);

        const solver = fork(path.join(__dirname, 'workers', 'identity.js'), [], {
            stdio: [0, 1, 2, 'ipc'],
            env: process.env,
        });


        solver.on('message', (msg) => {
            if (msg.error) {
                return log.error(`Derivation ${c} error, ${msg.error}`);
            }

            if (msg.attempts) {
                return events.emit('attempt');
            }

            events.emit('index', msg.index);
        });

        solver.on('error', (err) => {
            log.error(`Derivation ${c} error, ${err.message}`);
        });

        solver.send([xprv, index]);

        return solver;
    }

    /**
    * Register interface for controlling the node - using socket or port
    * @param config
    */
    registerControlInterface(config, node) {
        assert(
            !(parseInt(config.control_port_enabled, 10) &&
            parseInt(config.control_sock_enabled, 10)),
            'ControlSock and ControlPort cannot both be enabled',
        );

        const controller = new boscar.Server(new kadence.Control(node.ot));

        if (parseInt(config.control_port_enabled, 10)) {
            log.info(`Binding controller to port ${config.control_port}`);
            log.listen(parseInt(config.control_port, 10), '0.0.0.0');
        }

        if (parseInt(config.control_sock_enabled, 10)) {
            log.info(`Binding controller to path ${config.control_sock}`);
            controller.listen(config.control_sock);
        }
    }

    /**
    * Spawn solvers for hashes
    */
    spawnHashSolverProcesses() {
        const cpus = parseInt(config.cpus, 10);

        if (cpus === 0) {
            return log.info('There are no solver processes running');
        }

        if (os.cpus().length < cpus) {
            return log.error('Refusing to start more solvers than cpu cores');
        }

        for (let c = 0; c < cpus; c += 1) {
            this.forkHashSolver(c);
        }
    }

    /**
    * Create child processes for hash solvers
    * @param c
    */
    forkHashSolver(c) {
        log.info(`Forking solver process ${c}`);

        const solver = fork(path.join(__dirname, 'workers', 'solver.js'), [], {
            stdio: [0, 1, 2, 'ipc'],
            env: process.env,
        });

        solver.on('message', (msg) => {
            if (msg.error) {
                return log.error(`Solver ${c} error, ${msg.error}`);
            }

            log.info(`Solver ${c} found solution ` +
          `in ${msg.result.attempts} attempts (${ms(msg.result.time)})`);

            const solution = new kadence.permission.PermissionSolution(Buffer.from(msg.result.solution, 'hex'));
            node.ot.wallet.put(solution);
        });

        solver.on('error', (err) => {
            log.error(`solver ${c} error, ${err.message}`);
        });

        solver.send({ privateKey: node.ot.spartacus.privateKey.toString('hex') });
        this.solvers.push(solver);
    }

    /**
    * Get identity keys
    * @param string - extended private key
    * @return {{childkey: *, parentkey: *}}
    */
    getIdentityKeys(xprivkey) {
        // Start initializing identity keys
        const parentkey = hdkey.fromExtendedKey(xprivkey)
            .derive(kadence.constants.HD_KEY_DERIVATION_PATH);
        const childkey = parentkey.deriveChild(parseInt(config.child_derivation_index, 10));
        return {
            childkey,
            parentkey,
        };
    }

    /**
    * Verifies if we are on the test network and otherconfig checks
    */
    verifyConfiguration(config) {
        if (parseInt(config.test_network, 10)) {
            log.warn('Node is running in test mode, difficulties are reduced');
            process.env.kadence_TestNetworkEnabled = config.test_network;
            kadence.constants.SOLUTION_DIFFICULTY = 2;
            kadence.constants.IDENTITY_DIFFICULTY = 2;
        }

        if (parseInt(config.traverse_nat_enabled, 10) && parseInt(config.onion_enabled, 10)) {
            log.error('Refusing to start with both TraverseNatEnabled and ' +
          'OnionEnabled - this is a privacy risk');
            process.exit(1);
        }
    }

    /**
   * Validate identity and solve if not valid
   * @param identity
   * @param xprivkeyd
   */
    checkIdentity(identity, xprivkey) {
        this.xprivkey = xprivkey;
        this.identity = identity;
        if (!identity.validate(this.xprivkey, this.index)) {
            log.warn(`Identity is not yet generated. Identity derivation not yet solved - ${this.index} is invalid`);
            this.solveIdentity();
        }
    }
}

module.exports = NetworkUtilities;
