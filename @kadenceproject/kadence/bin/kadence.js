#!/usr/bin/env node

'use strict';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { EventEmitter } = require('events');
const { homedir } = require('os');
const assert = require('assert');
const async = require('async');
const program = require('commander');
const hdkey = require('hdkey');
const kadence = require('../index');
const bunyan = require('bunyan');
const RotatingLogStream = require('bunyan-rotating-file-stream');
const fs = require('fs');
const path = require('path');
const options = require('./config');
const npid = require('npid');
const daemon = require('daemon');
const pem = require('pem');
const levelup = require('levelup');
const leveldown = require('leveldown');
const boscar = require('boscar');
const { fork } = require('child_process');
const os = require('os');
const ms = require('ms');
const rc = require('rc');
const ini = require('ini');
const encoding = require('encoding-down');


program.version(`
  kadence  ${kadence.version.software}
  protocol ${kadence.version.protocol}
`);

program.description(`
  Copyright (c) 2018 Counterpoint Hackerspace, Ltd
  Copyright (c) 2018 Gordon Hall
  Licensed under the GNU Affero General Public License Version 3
`);

program.option('--config <file>', 'path to a kadence configuration file',
  path.join(homedir(), '.config/kadence/config'));
program.option('--datadir <path>', 'path to the default data directory',
  path.join(homedir(), '.config/kadence'));
program.option('--shutdown', 'sends the shutdown signal to the daemon');
program.option('--daemon', 'sends the kadence daemon to the background');
program.option('--solvers <cpus>', 'run the solver and generate kadence', '1');
program.option('--rpc <method> [params]', 'send a command to the daemon');
program.parse(process.argv);

let argv;

if (program.datadir) {
  argv = { config: path.join(program.datadir, 'config') };
  program.config = argv.config;
}

const solvers = [];

let config = rc('kadence', options(program.datadir), argv);
let xprivkey, parentkey, childkey, identity, logger, controller, node, wallet;


// Handle certificate generation
function _generateSelfSignedCertificate() {
  return new Promise((resolve, reject) => {
    pem.createCertificate({
      days: 365,
      selfSigned: true
    }, (err, keys) => {
      if (err) {
        return reject(err);
      }

      fs.writeFileSync(config.SSLKeyPath, keys.serviceKey);
      fs.writeFileSync(config.SSLCertificatePath, keys.certificate);
      resolve();
    });
  });
}

// Initialize logging
logger = bunyan.createLogger({
  name: 'kadence',
  streams: [
    {
      stream: new RotatingLogStream({
        path: config.LogFilePath,
        totalFiles: parseInt(config.LogFileMaxBackCopies),
        rotateExisting: true,
        gzip: false
      })
    },
    { stream: process.stdout }
  ],
  level: parseInt(config.VerboseLoggingEnabled) ? 'debug' : 'info'
});

if (parseInt(config.TestNetworkEnabled)) {
  logger.info('kadence is running in test mode, difficulties are reduced');
  process.env.kadence_TestNetworkEnabled = config.TestNetworkEnabled;
  kadence.constants.SOLUTION_DIFFICULTY = 2;
  kadence.constants.IDENTITY_DIFFICULTY = 2;
}

if (parseInt(config.TraverseNatEnabled) && parseInt(config.OnionEnabled)) {
  logger.error('refusing to start with both TraverseNatEnabled and ' +
    'OnionEnabled - this is a privacy risk');
  process.exit(1);
}

async function _init() {
  let index = parseInt(config.ChildDerivationIndex);

  // Generate a private extended key if it does not exist
  if (!fs.existsSync(config.PrivateExtendedKeyPath)) {
    fs.writeFileSync(
      config.PrivateExtendedKeyPath,
      kadence.utils.toHDKeyFromSeed().privateExtendedKey
    );
  }

  if (program.shutdown) {
    try {
      process.kill(parseInt(
        fs.readFileSync(config.DaemonPidFilePath).toString().trim()
      ), 'SIGTERM');
    } catch (err) {
      logger.error('failed to shutdown daemon, is it running?');
      process.exit(1);
    }
    process.exit();
  }

  if (!fs.existsSync(config.SSLKeyPath)) {
    await _generateSelfSignedCertificate();
  }

  if (program.daemon) {
    require('daemon')({ cwd: process.cwd() });
  }

  try {
    npid.create(config.DaemonPidFilePath).removeOnExit();
  } catch (err) {
    logger.error('Failed to create PID file, is kadence already running?');
    process.exit(1);
  }

  // Shutdown children cleanly on exit
  process.on('exit', killChildrenAndExit);
  process.on('SIGTERM', killChildrenAndExit);
  process.on('SIGINT', killChildrenAndExit);
  process.on('uncaughtException', (err) => {
    npid.remove(config.DaemonPidFilePath);
    logger.error(err.message);
    logger.debug(err.stack);
    process.exit(1);
  });
  process.on('unhandledRejection', (err) => {
    npid.remove(config.DaemonPidFilePath);
    logger.error(err.message);
    logger.debug(err.stack);
    process.exit(1);
  });

  // Initialize private extended key
  xprivkey = fs.readFileSync(config.PrivateExtendedKeyPath).toString();
  identity = new kadence.eclipse.EclipseIdentity(xprivkey, index);

  // If identity is not solved yet, start trying to solve it
  if (!identity.validate(xprivkey, index)) {
    logger.warn(`identity derivation not yet solved - ${index} is invalid`);

    let events = new EventEmitter();
    let opts = options(program.datadir);
    let start = Date.now(), time;
    let attempts = 0;
    let status = setInterval(() => {
      logger.info('still solving identity, ' +
        `currently ${attempts} of ${kadence.constants.MAX_NODE_INDEX} ` +
        `possible indices tested in the last ${ms(Date.now() - start)}`);
    }, 60000);

    logger.info(`solving identity derivation index with ${program.solvers} ` +
      'solver processes, this can take a while');

    events.on('attempt', () => attempts++);

    try {
      index = await spawnDerivationProcesses(xprivkey, events);
      time = Date.now() - start;
    } catch (err) {
      logger.error(err.message.toLowerCase());
      logger.info(`delete/move ${config.PrivateExtendedKeyPath} and restart`);
      process.exit(1);
    }

    events.removeAllListeners();
    clearInterval(status);
    logger.info(`solved identity derivation index ${index} in ${ms(time)}`);
    opts.ChildDerivationIndex = index;
    fs.writeFileSync(program.config, ini.stringify(opts));
    config = rc('kadence', opts, argv);
  }

  // Start initializing identity keys
  parentkey = hdkey.fromExtendedKey(xprivkey)
    .derive(kadence.constants.HD_KEY_DERIVATION_PATH);
  childkey = parentkey.deriveChild(parseInt(config.ChildDerivationIndex));
  identity = kadence.utils.toPublicKeyHash(childkey.publicKey)
    .toString('hex');

  init();
}

function killChildrenAndExit() {
  logger.info('exiting, killing child services, cleaning up');
  npid.remove(config.DaemonPidFilePath);
  process.removeListener('exit', killChildrenAndExit);

  if (controller && parseInt(config.ControlSockEnabled)) {
    controller.server.close();
  }

  solvers.forEach(s => s.kill('SIGTERM'));
  process.exit(0);
}

function registerControlInterface() {
  assert(!(parseInt(config.ControlPortEnabled) &&
           parseInt(config.ControlSockEnabled)),
  'ControlSock and ControlPort cannot both be enabled');

  controller = new boscar.Server(new kadence.Control(node));

  if (parseInt(config.ControlPortEnabled)) {
    logger.info('binding controller to port ' + config.ControlPort);
    controller.listen(parseInt(config.ControlPort), '0.0.0.0');
  }

  if (parseInt(config.ControlSockEnabled)) {
    logger.info('binding controller to path ' + config.ControlSock);
    controller.listen(config.ControlSock);
  }
}

function spawnSolverProcesses() {
  const cpus = parseInt(program.solvers);

  if (cpus === 0) {
    return logger.info('there are no solver processes running');
  }

  if (os.cpus().length < cpus) {
    return logger.error('refusing to start more solvers than cpu cores');
  }

  for (let c = 0; c < cpus; c++) {
    forkIdentitySolver(c);
  }
}

function forkIdentitySolver(c) {
  logger.info(`forking solver process ${c}`);

  let solver = fork(path.join(__dirname, 'workers', 'solver.js'), [], {
    stdio: [0, 1, 2, 'ipc'],
    env: process.env
  });

  solver.on('message', msg => {
    if (msg.error) {
      return logger.error(`solver ${c} error, ${msg.error}`);
    }

    logger.info(`solver ${c} found solution ` +
      `in ${msg.result.attempts} attempts (${ms(msg.result.time)})`);

    const solution = new kadence.permission.PermissionSolution(
      Buffer.from(msg.result.solution, 'hex')
    );

    node.wallet.put(solution);
  });

  solver.on('error', err => {
    logger.error(`solver ${c} error, ${err.message}`);
  });

  solver.send({ privateKey: node.spartacus.privateKey.toString('hex') });
  solvers.push(solver);
}

function spawnDerivationProcesses(xprivkey, events) {
  const cpus = parseInt(program.solvers);

  if (cpus === 0) {
    return logger.info('there are no derivation processes running');
  }

  if (os.cpus().length < cpus) {
    return logger.error('refusing to start more solvers than cpu cores');
  }

  for (let c = 0; c < cpus; c++) {
    let index = Math.floor(kadence.constants.MAX_NODE_INDEX / cpus) * c;
    let solver = forkDerivationSolver(c, xprivkey, index, events);

    solvers.push(solver);
    solver.once('exit', code => {
      if (code === 0) {
        logger.info(`derivation solver ${c} exited normally`);
      } else {
        logger.error(`derivation solver ${c} exited with code ${code}`);
      }
    });
  }

  return new Promise((resolve, reject) => {
    events.once('index', i => {
      events.removeAllListeners();
      solvers.forEach(s => s.kill('SIGTERM'));
      resolve(i);
    });
  })
}

function forkDerivationSolver(c, xprv, index, events) {
  logger.info(`forking derivation process ${c}`);

  let solver = fork(path.join(__dirname, 'workers', 'identity.js'), [], {
    stdio: [0, 1, 2, 'ipc'],
    env: process.env
  });

  solver.on('message', msg => {
    if (msg.error) {
      return logger.error(`derivation ${c} error, ${msg.error}`);
    }

    if (msg.attempts) {
      return events.emit('attempt');
    }

    events.emit('index', msg.index);
  });

  solver.on('error', err => {
    logger.error(`derivation ${c} error, ${err.message}`);
  });

  solver.send([xprv, index]);

  return solver;
}

async function init() {
  logger.info('initializing kadence');

  // Initialize public contact data
  const contact = {
    hostname: config.NodePublicAddress,
    protocol: 'https:',
    port: parseInt(config.NodePublicPort),
    xpub: parentkey.publicExtendedKey,
    index: parseInt(config.ChildDerivationIndex),
    agent: kadence.version.protocol
  };
  const key = fs.readFileSync(config.SSLKeyPath);
  const cert = fs.readFileSync(config.SSLCertificatePath);
  const ca = config.SSLAuthorityPaths.map(fs.readFileSync);

  // Initialize transport adapter
  const transport = new kadence.HTTPSTransport({ key, cert, ca });

  // Initialize protocol implementation
  node = new kadence.KademliaNode({
    logger,
    transport,
    contact,
    storage: levelup(encoding(leveldown(config.EmbeddedDatabaseDirectory)))
  });

  node.hashcash = node.plugin(kadence.hashcash({
    methods: ['PUBLISH', 'SUBSCRIBE'],
    difficulty: 8
  }));
  node.quasar = node.plugin(kadence.quasar());
  node.spartacus = node.plugin(kadence.spartacus(
    xprivkey,
    parseInt(config.ChildDerivationIndex),
    kadence.constants.HD_KEY_DERIVATION_PATH
  ));
  node.eclipse = node.plugin(kadence.eclipse());
  node.permission = node.plugin(kadence.permission({
    privateKey: node.spartacus.privateKey,
    walletPath: config.EmbeddedWalletDirectory
  }));
  node.rolodex = node.plugin(kadence.rolodex(config.EmbeddedPeerCachePath));

  logger.info('validating solutions in wallet, this can take some time');
  await node.wallet.validate();

  // Hibernate when bandwidth thresholds are reached
  if (!!parseInt(config.BandwidthAccountingEnabled)) {
    node.hibernate = node.plugin(kadence.hibernate({
      limit: config.BandwidthAccountingMax,
      interval: config.BandwidthAccountingReset,
      reject: ['FIND_VALUE', 'STORE']
    }));
  }

  // Use Tor for an anonymous overlay
  if (!!parseInt(config.OnionEnabled)) {
    kadence.constants.T_RESPONSETIMEOUT = 20000;
    node.onion = node.plugin(kadence.onion({
      dataDirectory: config.OnionHiddenServiceDirectory,
      virtualPort: config.OnionVirtualPort,
      localMapping: `127.0.0.1:${config.NodeListenPort}`,
      torrcEntries: {
        CircuitBuildTimeout: 10,
        KeepalivePeriod: 60,
        NewCircuitPeriod: 60,
        NumEntryGuards: 8,
        Log: `${config.OnionLoggingVerbosity} stdout`
      },
      passthroughLoggingEnabled: !!parseInt(config.OnionLoggingEnabled)
    }));
  }

  // Punch through NATs
  if (!!parseInt(config.TraverseNatEnabled)) {
    node.traverse = node.plugin(kadence.traverse([
      new kadence.traverse.UPNPStrategy({
        mappingTtl: parseInt(config.TraversePortForwardTTL),
        publicPort: parseInt(node.contact.port)
      }),
      new kadence.traverse.NATPMPStrategy({
        mappingTtl: parseInt(config.TraversePortForwardTTL),
        publicPort: parseInt(node.contact.port)
      })
    ]));
  }

  // Handle any fatal errors
  node.on('error', (err) => {
    logger.error(err.message.toLowerCase());
  });

  // Use verbose logging if enabled
  if (!!parseInt(config.VerboseLoggingEnabled)) {
    node.rpc.deserializer.append(new kadence.logger.IncomingMessage(logger));
    node.rpc.serializer.prepend(new kadence.logger.OutgoingMessage(logger));
  }

  // Cast network nodes to an array
  if (typeof config.NetworkBootstrapNodes === 'string') {
    config.NetworkBootstrapNodes = config.NetworkBootstrapNodes.trim().split();
  }

  async function joinNetwork(callback) {
    let peers = config.NetworkBootstrapNodes.concat(
      await node.rolodex.getBootstrapCandidates()
    );

    if (peers.length === 0) {
      logger.info('no bootstrap seeds provided and no known profiles');
      logger.info('running in seed mode (waiting for connections)');

      return node.router.events.once('add', (identity) => {
        config.NetworkBootstrapNodes = [
          kadence.utils.getContactURL([
            identity,
            node.router.getContactByNodeId(identity)
          ])
        ];
        joinNetwork(callback)
      });
    }

    logger.info(`joining network from ${peers.length} seeds`);
    async.detectSeries(peers, (url, done) => {
      const contact = kadence.utils.parseContactURL(url);
      node.join(contact, (err) => {
        done(null, (err ? false : true) && node.router.size > 1);
      });
    }, (err, result) => {
      if (!result) {
        logger.error('failed to join network, will retry in 1 minute');
        callback(new Error('Failed to join network'));
      } else {
        callback(null, entry);
      }
    });
  }

  node.listen(parseInt(config.NodeListenPort), () => {
    logger.info(
      `node listening on local port ${config.NodeListenPort} ` +
      `and exposed at https://${node.contact.hostname}:${node.contact.port}`
    );
    registerControlInterface();
    spawnSolverProcesses();
    async.retry({
      times: Infinity,
      interval: 60000
    }, done => joinNetwork(done), (err, entry) => {
      if (err) {
        logger.error(err.message);
        process.exit(1);
      }

      logger.info(
        `connected to network via ${entry[0]} ` +
        `(http://${entry[1].hostname}:${entry[1].port})`
      );
      logger.info(`discovered ${node.router.size} peers from seed`);
    });
  });
}

// Check if we are sending a command to a running daemon's controller
if (program.rpc) {
  assert(!(parseInt(config.ControlPortEnabled) &&
           parseInt(config.ControlSockEnabled)),
    'ControlSock and ControlPort cannot both be enabled');

  const client = new boscar.Client();

  if (parseInt(config.ControlPortEnabled)) {
    client.connect(parseInt(config.ControlPort));
  } else if (parseInt(config.ControlSockEnabled)) {
    client.connect(config.ControlSock);
  }

  client.on('ready', () => {
    const [method, ...params] = program.rpc.split(' ');
    client.invoke(method, params, function(err, ...results) {
      if (err) {
        console.error(err);
        process.exit(1);
      } else {
        console.info(results);
        process.exit(0);
      }
    });
  });

  client.on('error', err => {
    console.error(err);
    process.exit(1)
  });
} else {
  // Otherwise, kick everything off
  _init();
}
