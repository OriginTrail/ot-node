const fs = require('fs');
const path = require('path');
const assert = require('assert');
const boscar = require('boscar');
const utilities = require('../../Utilities');
const Control = require('../../Control');
const Bucket = require('@deadcanaries/kadence/lib/bucket');

class KademliaUtils {
    constructor(ctx) {
        this.solvers = [];
        this.log = ctx.logger;
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

    /**
     * Save bootstrap nodes
     */
    setBootstraps(nodes) {
        const filePath = path.join(this.config.appDataPath, 'bootstraps.json');
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        fs.writeFileSync(filePath, JSON.stringify(nodes));
    }

    /**
     * Check if bootstrap nodes have changed
     */
    checkBootstraps(nodes) {
        const filePath = path.join(this.config.appDataPath, 'bootstraps.json');
        if (!fs.existsSync(filePath) || nodes.length === 0) {
            return false;
        }

        const existingBootstraps = JSON.parse(fs.readFileSync(filePath));

        for (let i = 0; i < existingBootstraps.length; i += 1) {
            if (nodes.indexOf(existingBootstraps[i]) === -1) {
                return false;
            }
        }
        return true;
    }

    /**
     * Save routing table
     */
    setRoutingTable(map) {
        const obj = {};

        map.forEach((value, key) => {
            const childObj = {};
            value.forEach((childValue, childKey) => {
                childObj[childKey] = childValue;
            });
            obj[key] = childObj;
        });

        const filePath = path.join(this.config.appDataPath, 'router.json');
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        const result = JSON.stringify({ timestamp: new Date(), routingTable: obj });
        fs.writeFileSync(filePath, result);
    }

    /**
     * Load routing table
     */
    getRoutingTable(router) {
        const routinTableValidityPeriod =
            1000 * 60 * 60 * this.config.network.routing_table_validity_period_in_hours;
        const filePath = path.join(this.config.appDataPath, 'router.json');
        if (!fs.existsSync(filePath)) {
            return false;
        }
        try {
            const obj = JSON.parse(fs.readFileSync(filePath));
            const { routingTable } = obj;
            const lastTimestamp = new Date(obj.timestamp);
            const currentTimestamp = new Date() - routinTableValidityPeriod;

            if (lastTimestamp > currentTimestamp) {
                Object.keys(routingTable).forEach((key) => {
                    const value = routingTable[key];
                    const childMap = new Bucket();
                    Object.keys(value).forEach((childKey) => {
                        childMap.set(childKey, value[childKey]);
                    });
                    router.set(parseInt(key, 10), childMap);
                });
                return true;
            }
        } catch (e) {
            this.log.error('Error while getting cached routing table. Error message: ', e.message);
        }

        return false;
    }
}

module.exports = KademliaUtils;
