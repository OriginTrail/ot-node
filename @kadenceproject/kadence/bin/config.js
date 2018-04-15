'use strict';

const ini = require('ini');
const { existsSync, writeFileSync } = require('fs');
const mkdirp = require('mkdirp');
const { tmpdir, homedir } = require('os');
const { join } = require('path');

const DEFAULT_DATADIR = join(homedir(), '.config/kadence');

module.exports = function(datadir) {

  datadir = datadir || DEFAULT_DATADIR;

  const options = {

    // Process PID
    DaemonPidFilePath: join(datadir, 'kadence.pid'),

    // Identity/Cryptography
    PrivateExtendedKeyPath: join(datadir, 'kadence.prv'),
    ChildDerivationIndex: '0',

    // Database
    EmbeddedDatabaseDirectory: join(datadir, 'kadence.dht'),
    EmbeddedPeerCachePath: join(datadir, 'peercache'),
    EmbeddedWalletDirectory: join(datadir, 'wallet.dat'),

    // Node Options
    NodePublicPort: '5274',
    NodeListenPort: '5274',
    NodePublicAddress: '127.0.0.1',
    NodeListenAddress: '0.0.0.0',

    // Onion Plugin
    OnionEnabled: '0',
    OnionVirtualPort: '443',
    OnionHiddenServiceDirectory: join(datadir, 'hidden_service'),
    OnionLoggingVerbosity: 'notice',
    OnionLoggingEnabled: '0',

    // Bandwidth Metering
    BandwidthAccountingEnabled: '0',
    BandwidthAccountingMax: '5GB',
    BandwidthAccountingReset: '24HR',

    // NAT Traversal
    TraverseNatEnabled: '1',
    TraversePortForwardTTL: '0',

    // SSL Certificate
    SSLCertificatePath: join(datadir, 'kadence.crt'),
    SSLKeyPath: join(datadir, 'kadence.key'),
    SSLAuthorityPaths: [

    ],

    // Network Bootstrapping
    NetworkBootstrapNodes: [

    ],

    // Debugging/Developer
    VerboseLoggingEnabled: '1',
    LogFilePath: join(datadir, 'kadence.log'),
    LogFileMaxBackCopies: '3',

    // Local Control Protocol
    ControlPortEnabled: '0',
    ControlPort: '5275',
    ControlSockEnabled: '1',
    ControlSock: join(datadir, 'kadence.sock'),

    // Enables the Test Mode (lowers difficulty)
    TestNetworkEnabled: '0'

  };

  if (!existsSync(join(datadir, 'config'))) {
    mkdirp.sync(datadir);
    writeFileSync(join(datadir, 'config'), ini.stringify(options));
  }

  if (!existsSync(join(datadir, 'wallet.dat'))) {
    mkdirp.sync(join(datadir, 'wallet.dat'));
  }

  if (!existsSync(join(datadir, 'kadence.dht'))) {
    mkdirp.sync(join(datadir, 'kadence.dht'));
  }

  return options;
};
