const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const models = require('../../models');


class HighAvailabilityService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.otNodeClient = ctx.otNodeClient;
    }

    async startHighAvailabilityNode(forkedStatusCheck) {
        if (this.config.high_availability.is_fallback_node) {
            this.logger.notify('Entering busy wait loop');
            // start replication for arango
            await this._updateConfigurationOnRemoteNode(
                false,
                this.config.high_availability.master_hostname,
                this.config.high_availability.master_hostname,
                false,
            );
            await this.graphStorage.startReplication();

            let doWhile = true;
            do {
                // eslint-disable-next-line no-await-in-loop
                const nodeStatus = await models.node_status.findOne({
                    where: { hostname: this.config.high_availability.master_hostname },
                });

                if (nodeStatus) {
                    const elapsed = (new Date() - new Date(nodeStatus.timestamp)) / 1000;
                    if (elapsed > 10) {
                        doWhile = false;
                    }
                } else {
                    doWhile = false;
                }

                // eslint-disable-next-line no-await-in-loop
                await this.getMasterNodeData();
                const waitTime = this.config.high_availability.switch_nodes_in_minutes * 60 * 1000;
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve, reject) => {
                    setTimeout(() => resolve('done!'), waitTime);
                });
            } while (doWhile);
            this.logger.notify('Exiting busy wait loop');
            await this.getMasterNodeData();
            await this.graphStorage.stopReplication();
            await this._updateConfigurationOnRemoteNode(
                true,
                this.config.high_availability.master_hostname,
                this.config.high_availability.private_hostname,
                true,
            );

            // we probably don't need this
            this.config.high_availability.is_fallback_node = false;
            this.config.high_availability.master_hostname =
                this.config.high_availability.private_hostname;

            forkedStatusCheck.send(JSON.stringify({ config: this.config }));
        } else {
            const replicationState = await this.graphStorage.getReplicationApplierState();
            if (replicationState.state.running) {
                await this.graphStorage.stopReplication();
            }

            forkedStatusCheck.send(JSON.stringify({ config: this.config }));
        }
    }

    async _updateConfigurationOnRemoteNode(
        isFallbackNode,
        remoteNodeHostname,
        newMasterHostname,
        restartMasterNode,
    ) {
        this.logger.trace('Updated configuration on previous master node.');
        const remoteConfigFolderPath = '/ot-node/remote_config';
        const remoteConfigPath = `${remoteConfigFolderPath}/.origintrail_noderc`;
        execSync(`mkdir -p ${remoteConfigFolderPath}`);
        execSync(`scp root@${remoteNodeHostname}:~/.origintrail_noderc ${remoteConfigFolderPath}`);
        const remoteConfig = JSON.parse(fs.readFileSync(remoteConfigPath));
        remoteConfig.high_availability.is_fallback_node = isFallbackNode;
        remoteConfig.high_availability.master_hostname = newMasterHostname;
        fs.writeFileSync(remoteConfigPath, JSON.stringify(remoteConfig, null, 4));
        execSync(`scp ${remoteConfigPath} root@${remoteNodeHostname}:~/.origintrail_noderc`);
        if (restartMasterNode) {
            execSync(`ssh root@${remoteNodeHostname} "docker restart otnode"`);
            this.logger.trace('Master node restarted');
        }
    }

    async getMasterNodeData(masterHostname) {
        try {
            const request = {};
            // fetch identities if missing
            const identityFilePath = path.join(
                this.config.appDataPath,
                this.config.erc725_identity_filepath,
            );
            if (!fs.existsSync(identityFilePath)) {
                request.erc725Identity = true;
            }
            const kademliaCertFilePath = path.join(
                this.config.appDataPath,
                this.config.ssl_certificate_path,
            );
            if (!fs.existsSync(kademliaCertFilePath)) {
                request.kademliaCert = true;
            }
            const kademliaKeyFilePath = path.join(
                this.config.appDataPath,
                this.config.ssl_keypath,
            );
            if (!fs.existsSync(kademliaKeyFilePath)) {
                request.kademliaKey = true;
            }
            const bootstrapsFilePath = path.join(
                this.config.appDataPath,
                'bootstraps.json',
            );
            if (!fs.existsSync(bootstrapsFilePath)) {
                request.bootstraps = true;
            }
            const routingTableFilePath = path.join(
                this.config.appDataPath,
                'router.json',
            );
            if (!fs.existsSync(routingTableFilePath)) {
                request.routingTable = true;
            }
            const masterNodeData = await this.otNodeClient.getNodeData(masterHostname, request);

            console.log(masterNodeData);

            if (masterNodeData.erc725Identity) {
                fs.writeFileSync(path.join(
                    this.config.appDataPath,
                    this.config.erc725_identity_filepath,
                ), masterNodeData.erc725Identity);
            }
            if (masterNodeData.kademliaCert) {
                fs.writeFileSync(path.join(
                    this.config.appDataPath,
                    this.config.ssl_certificate_path,
                ), masterNodeData.kademliaCert);
            }
            if (masterNodeData.kademliaKey) {
                fs.writeFileSync(path.join(
                    this.config.appDataPath,
                    this.config.ssl_keypath,
                ), masterNodeData.kademliaKey);
            }
            if (masterNodeData.bootstraps) {
                fs.writeFileSync(path.join(
                    this.config.appDataPath,
                    'bootstraps.json',
                ), masterNodeData.bootstraps);
            }
            if (masterNodeData.routingTable) {
                fs.writeFileSync(path.join(
                    this.config.appDataPath,
                    'router.json',
                ), masterNodeData.routingTable);
            }
        } catch (e) {
            this.logger.error(e.message);
        }
    }
}

module.exports = HighAvailabilityService;
