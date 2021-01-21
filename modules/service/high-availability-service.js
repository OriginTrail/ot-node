const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const Models = require('../../models');
const constants = require('../constants');
// eslint-disable-next-line import/no-extraneous-dependencies
const { Pool } = require('pg');
const Utilities = require('../Utilities');

class HighAvailabilityService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.otNodeClient = ctx.otNodeClient;
    }

    async startHighAvailabilityNode() {
        if (process.env.DB_TYPE !== constants.DB_TYPE.psql) {
            this.logger.notify('Not able to start as high availability node. Postgres database needs to be used.');
            return;
        }
        const { fallback_sync_attempts_number, fallback_sync_attempts_delay } =
            this.config.high_availability;
        const remoteNodeAvailable = await this.isRemoteNodeAvailable();
        if (remoteNodeAvailable) {
            for (let i = 0; i < fallback_sync_attempts_number; i += 1) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await this.startFallbackSync();
                    break;
                } catch (error) {
                    this.logger.error('Unable to start fallback node. Error: ', error);
                    if (i + 1 === fallback_sync_attempts_number) {
                        this.logger.important(`Unable to start node as fallback. Active node ip: ${this.config.high_availability.remote_ip_address}`);
                        process.exit(1);
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await Utilities.sleepForMilliseconds(fallback_sync_attempts_delay);
                }
            }
        }
        this.logger.info('Starting as active node');

        this.stopPostgresReplication();
        await this.updateActiveAndFallbackNodeState();

        const replicationState = await this.graphStorage.getReplicationApplierState();
        if (replicationState.state.running) {
            await this.graphStorage.stopReplication();
        }
    }

    async updateActiveAndFallbackNodeState() {
        const nodeStatuses = await Models.node_status.findAll();

        const activeNode = nodeStatuses.find(nodeStatus =>
            nodeStatus.hostname === this.config.high_availability.private_ip_address);

        await this.updateOrCreateNodeState(
            activeNode,
            constants.NODE_STATUS.active,
            this.config.high_availability.private_ip_address,
        );

        const fallbackNode = nodeStatuses.filter(nodeStatus =>
            nodeStatus.hostname === this.config.high_availability.remote_hostname);

        await this.updateOrCreateNodeState(
            fallbackNode,
            constants.NODE_STATUS.fallback,
            this.config.high_availability.remote_hostname,
        );
    }

    async updateOrCreateNodeState(nodeState, status, hostname) {
        if (nodeState) {
            await Models.node_status.update(
                {
                    status,
                },
                {
                    where: {
                        hostname,
                    },
                },
            );
        } else {
            await Models.node_status.create({
                hostname,
                status,
                timestamp: new Date(),
            });
        }
    }

    async startFallbackSync() {
        this.logger.notify('Entering busy wait loop');
        const {
            active_node_data_sync_interval_in_hours,
            is_remote_node_available_attempts_delay,
            remote_operational_db_username,
            remote_hostname,
            remote_ip_address,
        } = this.config.high_availability;
        await this.getMasterNodeData(remote_hostname);

        await this.graphStorage.startReplication();
        this.startPostgresReplication(remote_ip_address, remote_operational_db_username);
        let remoteNodeAvailable = true;
        const refreshIntervalId = setInterval(
            async () => {
                if (remoteNodeAvailable) {
                    await this.getMasterNodeData(remote_hostname);
                }
            },
            active_node_data_sync_interval_in_hours * 60 * 60 * 1000,
        );
        do {
            // eslint-disable-next-line no-await-in-loop
            await Utilities.sleepForMilliseconds(is_remote_node_available_attempts_delay);
            // eslint-disable-next-line no-await-in-loop
            remoteNodeAvailable = await this.isRemoteNodeAvailable();
        } while (remoteNodeAvailable);
        this.logger.important('Master node is unresponsive. I am taking over.');
        clearInterval(refreshIntervalId);
        this.restartRemoteNode(remote_ip_address);
    }

    async restartRemoteNode(remoteNodeHostname) {
        const remoteNodeStatus = await this.fetchNodeStatus(remoteNodeHostname);

        if (remoteNodeStatus && remoteNodeStatus === constants.NODE_STATUS.updating) {
            this.logger.trace('Remote node is in update process, skipping node restart');
            return;
        }

        exec(`ssh root@${remoteNodeHostname} "docker restart otnode"`, (error, stdout, stderr) => {
            if (error) {
                this.logger.error(`Unable to restart remote node error: ${error.message}`);
                return;
            }
            if (stderr) {
                this.logger.error(`Unable to restart remote node error: ${stderr}`);
                return;
            }
            this.logger.trace('Remote node restarted');
        });
    }

    async fetchNodeStatus(hostname) {
        const pool = new Pool({
            user: this.config.operational_db.username,
            host: this.config.operational_db.host,
            database: this.config.operational_db.database,
            password: this.config.operational_db.password,
            port: this.config.operational_db.port,
        });
        const client = await pool.connect();

        let remoteNodeStatus;
        try {
            const response = await client.query('SELECT * FROM node_status where hostname= $1', [hostname]);
            const nodeStatus = response.rows[0];
            remoteNodeStatus = nodeStatus.status;
        } catch (e) {
            this.logger.error(`Unable to get remote node status from db. Error: ${e}`);
        } finally {
            client.release();
        }
        return remoteNodeStatus;
    }

    async getMasterNodeData(masterHostname) {
        this.logger.trace('Synchronizing with master node....');
        const message = {};
        // fetch identities if missing
        const networkIdentity = path.join(
            this.config.appDataPath,
            this.config.identity_filepath,
        );
        if (!fs.existsSync(networkIdentity)) {
            message.networkIdentity = true;
        }
        const kademliaCertFilePath = path.join(
            this.config.appDataPath,
            this.config.ssl_certificate_path,
        );
        if (!fs.existsSync(kademliaCertFilePath)) {
            message.kademliaCert = true;
        }
        const kademliaKeyFilePath = path.join(
            this.config.appDataPath,
            this.config.ssl_keypath,
        );
        if (!fs.existsSync(kademliaKeyFilePath)) {
            message.kademliaKey = true;
        }

        message.blockchain = [];

        for (const implementation of this.config.blockchain.implementations) {
            const missingParameters = {};

            const identityFilePath = path.join(
                this.config.appDataPath,
                implementation.identity_filepath,
            );
            if (!fs.existsSync(identityFilePath)) {
                missingParameters.identity = true;
            }

            const nodeWalletFilePath = path.join(
                this.config.appDataPath,
                implementation.node_wallet_filepath,
            );
            if (!fs.existsSync(nodeWalletFilePath)) {
                missingParameters.wallet = true;
            }

            if (Object.keys(missingParameters).length !== 0) {
                missingParameters.network_id = implementation.network_id;
                message.blockchain.push(missingParameters);
            }
        }
        if (message.blockchain.length === 0) message.blockchain = false;

        message.bootstraps = true;
        message.routingTable = true;

        message.wallet = this.config.node_wallet;
        const request = {
            message,
            messageSignature: Utilities.generateRsvSignature(
                message,
                this.config.node_private_key,
            ),
        };

        const masterNodeData = await this.otNodeClient.getNodeData(
            masterHostname,
            request,
            this.config.high_availability.active_node_data_sync_use_ssl,
        );

        if (masterNodeData.networkIdentity) {
            fs.writeFileSync(path.join(
                this.config.appDataPath,
                this.config.identity_filepath,
            ), masterNodeData.networkIdentity);
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
        if (masterNodeData.blockchain) {
            for (const response of masterNodeData.blockchain) {
                const { network_id, wallet, identity } = response;
                const { node_wallet_path, identity_filepath } =
                    this.config.blockchain.implementations.find(e => e.network_id === network_id);

                if (identity) {
                    fs.writeFileSync(path.join(
                        this.config.appDataPath,
                        identity_filepath,
                    ), JSON.stringify({ identity }));
                }
                if (wallet) {
                    fs.writeFileSync(path.join(
                        this.config.appDataPath,
                        node_wallet_path,
                    ), JSON.stringify(wallet));
                }
            }
        }

        this.logger.trace('Synchronizing with master node completed.');
    }

    startPostgresReplication(remoteHostname, remoteOpDbUsername) {
        this.logger.trace('Starting postgres replication');
        execSync('/etc/init.d/postgresql stop');
        if (fs.existsSync('/var/lib/postgresql/12/main')) {
            execSync('rm -rfv /var/lib/postgresql/12/main/*');
        }
        execSync(`su -c "pg_basebackup -h ${remoteHostname} -U ${remoteOpDbUsername} -p 5432 -D /var/lib/postgresql/12/main/  -Fp -Xs -P -R" - postgres`);
        execSync('/etc/init.d/postgresql start');
        this.logger.trace('Postgres replication started successfully');
    }

    stopPostgresReplication() {
        try {
            this.logger.trace('Stopping postgres replication');
            execSync('pg_ctlcluster 12 main promote');
            this.logger.trace('Postgres replication stopped successfully');
        } catch (error) {
            if (error.message.includes('server is not in standby mode')) {
                return;
            }
            throw error;
        }
    }

    async isRemoteNodeAvailable() {
        const {
            remote_hostname,
            is_remote_node_available_attempts_number,
            is_remote_node_available_attempts_delay,
            is_remote_node_available_attempts_timeout,
            active_node_data_sync_use_ssl,
        } = this.config.high_availability;

        for (let i = 0; i < is_remote_node_available_attempts_number; i += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const response = await this.otNodeClient.healthCheck(
                    remote_hostname,
                    is_remote_node_available_attempts_timeout,
                    active_node_data_sync_use_ssl,
                );
                if (response.statusCode === 200) {
                    return true;
                }
                this.logger.trace('Remote node is not in active state. attempt: ', i + 1);
            } catch (error) {
                this.logger.trace(`Unable to fetch health check for remote node error: ${error.message}, attempt: ${i + 1}`);
            }
            if (i + 1 < is_remote_node_available_attempts_number) {
                // eslint-disable-next-line no-await-in-loop
                await Utilities.sleepForMilliseconds(is_remote_node_available_attempts_delay);
            }
        }
        this.logger.info('Remote node is not in active state.');
        return false;
    }
}

module.exports = HighAvailabilityService;

