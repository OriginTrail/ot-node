const fs = require('fs');
const path = require('path');
const assert = require('assert');
const boscar = require('boscar');
const utilities = require('../../Utilities');
const Control = require('../../Control');

class KademliaUtils {
    constructor(ctx) {
        this.solvers = [];
        this.log = ctx.logger;
        this.notifyError = ctx.notifyError;
        this.config = ctx.config;
    }

    /**
    * Checks existence of SSL certificate and if not, generates one
    * @return {Promise<boolean>}
    */
    async setSelfSignedCertificate() {
        if (!fs.existsSync(path.join(this.config.appDataPath, this.config.ssl_keypath))) {
            const result = await utilities.generateSelfSignedCertificate(this.config);
            if (result) {
                this.log.info('SSL generated');
                return true;
            }
        }
        this.log.info('SSL checked successfully');
        return true;
    }

    /**
     * Returns certificates based on configuration.
     *
     * If config.node_rpc_use_ssl enabled a certificate for RPC will be used
     * (node_rpc_ssl_key_path, node_rpc_ssl_cert_path).
     */
    getCertificates() {
        if (this.config.node_rpc_use_ssl) {
            return {
                key: fs.readFileSync(this.config.node_rpc_ssl_key_path),
                cert: fs.readFileSync(this.config.node_rpc_ssl_cert_path),
            };
        }
        return {
            key: fs.readFileSync(path.join(
                this.config.appDataPath,
                this.config.ssl_keypath,
            )),
            cert: fs.readFileSync(path.join(
                this.config.appDataPath,
                this.config.ssl_certificate_path,
            )),
        };
    }

    /**
    * Register interface for controlling the node - using socket or port
    * @param config
    */
    registerControlInterface(config, node) {
        assert(
            !(config.control_port_enabled &&
            config.control_sock_enabled),
            'ControlSock and ControlPort cannot both be enabled',
        );

        const controller = new boscar.Server(new Control(config, node));

        if (config.control_port_enabled) {
            this.log.notify(`Binding controller to port ${config.control_port}`);
            controller.listen(config.control_port, '0.0.0.0');
        }

        if (config.control_sock_enabled) {
            this.log.notify(`Binding controller to path ${config.control_sock}`);
            controller.listen(config.control_sock);
        }
    }

    /**
    * Verifies if we are on the test network and otherconfig checks
    */
    verifyConfiguration(config) {
        if (config.traverse_nat_enabled && config.onion_enabled) {
            this.log.error('Refusing to start with both TraverseNatEnabled and ' +
          'OnionEnabled - this is a privacy risk');
            process.exit(1);
        }
    }
}

module.exports = KademliaUtils;
