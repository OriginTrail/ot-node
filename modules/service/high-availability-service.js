const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

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
            await this.getMasterNodeData(this.config.high_availability.master_hostname);
            await this.graphStorage.startReplication();
            this.startPostgresReplication(this.config.high_availability.remote_hostname);
            let doWhile = true;
            const pool = new Pool({
                user: 'ot_node',
                host: 'localhost',
                database: 'ot_node_db',
                password: 'origintrail',
                port: 5432,
            });
            const client = await pool.connect();
            do {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const response = await client.query('SELECT * FROM node_status where hostname= $1', [this.config.high_availability.master_hostname]);
                    const nodeStatus = response.rows[0];

                    if (nodeStatus) {
                        const elapsed = (new Date() - new Date(nodeStatus.timestamp)) / 1000;
                        if (elapsed > 10) {
                            this.logger.notify('Master node unresponsive taking over...');
                            doWhile = false;
                        }
                    } else {
                        doWhile = false;
                    }
                } catch (e) {
                    this.logger.error(e);
                }
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve, reject) => {
                    setTimeout(() => resolve('done!'), 2000);
                });
            } while (doWhile);
            client.release();
            await this.graphStorage.stopReplication();
            this.stopPostgresReplication();
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
        if (!fs.existsSync(remoteConfigFolderPath)) {
            execSync(`mkdir -p ${remoteConfigFolderPath}`);
        }
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
            this.logger.trace('Synchronizing with master node....');
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
            this.logger.trace('Synchronizing with master node completed.');
        } catch (e) {
            this.logger.error(e.message);
        }
    }

    startPostgresReplication(remoteHostname) {
        this.logger.trace('Starting postgres replication');
        execSync('/etc/init.d/postgresql stop');
        execSync('rm -rfv /var/lib/postgresql/12/main/*');
        execSync(`su -c "pg_basebackup -h ${remoteHostname} -U ot_node -p 5432 -D /var/lib/postgresql/12/main/  -Fp -Xs -P -R" - postgres`);
        execSync('/etc/init.d/postgresql start');
        this.logger.trace('Postgres replication started successfully');
    }

    stopPostgresReplication() {
        this.logger.trace('Stopping postgres replication');
        execSync('pg_ctlcluster 12 main promote');
        this.logger.trace('Postgres replication stopped successfully');
    }
}

module.exports = HighAvailabilityService;

