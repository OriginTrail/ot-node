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

                const waitTime = this.config.high_availability.switch_nodes_in_minutes * 60 * 1000;
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve, reject) => {
                    setTimeout(() => resolve('done!'), waitTime);
                });
            } while (doWhile);
            this.logger.notify('Exiting busy wait loop');
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
        const request = {
            kadenceDHT: true,
        };
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
        const masterNodeData = await this.otNodeClient.getNodeData(masterHostname, request);

        console.log(masterNodeData);
    }
}

module.exports = HighAvailabilityService;
