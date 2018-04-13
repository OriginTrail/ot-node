/**
 * @module kadence/onion
 */

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const split = require('split');
const merge = require('merge');
const socks = require('socks');
const hsv3 = require('hsv3');


/**
 * SOCKS5 proxy plugin, wraps HTTP* transports createRequest method
 */
class OnionPlugin {

  static get DEFAULTS() {
    return {
      dataDirectory: path.join(os.tmpdir(), 'kad-onion-default'),
      virtualPort: 80,
      localMapping: '127.0.0.1:8080',
      passthroughLoggingEnabled: false,
      torrcEntries: {}
    };
  }

  /**
   * Creates the transport wrapper for using a SOCKS5 proxy
   * @constructor
   * @param {object} node
   * @param {object} [options]
   * @param {string} [options.dataDirectory] - Write hidden service data
   * @param {number} [options.virtualPort] - Virtual hidden service port
   * @param {string} [options.localMapping] - IP/Port string of target service
   * @param {object} [options.torrcEntries] - Additional torrc entries
   * @param {boolean} [options.passthroughLoggingEnabled] - Passthrough tor log
   */
  constructor(node, options) {
    this._opts = merge(OnionPlugin.DEFAULTS, options);
    this.logger = node.logger;
    this.node = node;
    this.node.onion = this;

    this._wrapNodeListen(node);
  }

  /**
   * Returns an agent instance to use for the provided target
   * @returns {Agent}
   */
  createSecureAgent() {
    return new socks.Agent({
      proxy: {
        ipaddress: '127.0.0.1',
        port: this.socksPort,
        type: 5
      },
      timeout: 30000
    }, true, false);
  }

  /**
   * Returns a clear text agent instance to use for the provided target
   * @returns {Agent}
   */
  createClearAgent() {
    return new socks.Agent({
      proxy: {
        ipaddress: '127.0.0.1',
        port: this.socksPort,
        type: 5
      },
      timeout: 30000
    }, false, false);
  }

  /**
   * @private
   */
  _wrapTransportRequest(transport) {
    this._createRequest = this._createRequest ||
                          transport._createRequest.bind(transport);

    transport._createRequest = (options) => {
      options.agent = options.protocol === 'https:'
                    ? this.createSecureAgent()
                    : this.createClearAgent();

      return this._createRequest(options);
    };
  }

  /**
   * @private
   */
  _waitForBootstrap() {
    return new Promise(resolve => {
      this.tor.on('STATUS_CLIENT', (status) => {
        let notice = status[0].split(' ')[1];
        let summary = null;

        if (status[0].includes('SUMMARY')) {
          summary = status[0].split('SUMMARY="');
          summary = summary[summary.length - 1].split('"')[0];
        }

        if (notice === 'CIRCUIT_ESTABLISHED') {
          this.logger.info('connected to the tor network');
          this.tor.removeEventListeners(() => resolve());
        } else if (summary) {
          this.logger.info('bootstrapping tor, ' + summary.toLowerCase());
        }
      });

      this.tor.addEventListeners(['STATUS_CLIENT'], () => {
        this.logger.info('listening for bootstrap status for tor client');
      });
    });
  }

  /**
   * @private
   */
  _getSocksProxyPort() {
    return new Promise((resolve, reject) => {
      this.logger.info('connected to tor control port');
      this.logger.info('querying tor for socks proxy port');

      this.tor.getInfo('net/listeners/socks', (err, result) => {
        if (err) {
          return reject(err);
        }

        let [, socksPort] = result.replace(/"/g, '').split(':');
        this.socksPort = parseInt(socksPort);

        resolve(this.socksPort);
      });
    });
  }

  /**
   * @private
   */
  async _setupTorController() {
    return new Promise((resolve, reject) => {
      this.tor = hsv3([
        {
          dataDirectory: path.join(this._opts.dataDirectory, 'hidden_service'),
          virtualPort: this._opts.virtualPort,
          localMapping: this._opts.localMapping
        }
      ], merge(this._opts.torrcEntries, {
        DataDirectory: this._opts.dataDirectory
      }));

      this.tor.on('error', reject).on('ready', async () => {
        await this._waitForBootstrap();
        await this._getSocksProxyPort();

        this.node.contact.hostname = fs.readFileSync(
          path.join(this._opts.dataDirectory, 'hidden_service', 'hostname')
        ).toString().trim();
        this.node.contact.port = this._opts.virtualPort;

        this._wrapTransportRequest(this.node.transport);
        resolve();
      });

      if (this._opts.passthroughLoggingEnabled) {
        this.tor.process.stdout.pipe(split()).on('data', (data) => {
          let message = data.toString().split(/\[(.*?)\]/);

          message.shift(); // NB: Remove timestamp
          message.shift(); // NB: Remove type
          message[0] = message[0] ? message[0].trim() : ''; // NB: Trim white
          message = message.join(''); // NB: Put it back together

          this.logger.info(`tor process: ${message}`);
        });
      }
    });
  }

  /**
   * @private
   */
  async _wrapNodeListen(node) {
    const listen = node.listen.bind(node);

    node.listen = async (port, address, callback) => {
      this.logger.info('spawning tor client and controller');

      if (typeof address === 'function') {
        callback = address;
        address = '127.0.0.1';
      }

      try {
        await this._setupTorController();
      } catch (err) {
        return node.emit('error', err);
      }

      listen(port, address, callback);
    };
  }

}

/**
 * Registers a {@link OnionPlugin} with an {@link AbstractNode}
 * @param {object} node
 * @param {object} [options]
 * @param {string} [options.dataDirectory] - Write hidden service data
 * @param {number} [options.virtualPort] - Virtual hidden service port
 * @param {string} [options.localMapping] - IP/Port string of target service
 * @param {object} [options.torrcEntries] - Additional torrc entries
 * @param {boolean} [options.passthroughLoggingEnabled] - Passthrough tor log
 */
module.exports = function(options) {
  return function(node) {
    return new OnionPlugin(node, options);
  }
};

module.exports.OnionPlugin = OnionPlugin;
