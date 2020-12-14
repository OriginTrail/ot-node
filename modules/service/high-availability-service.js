const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const Models = require('../../models');
const constants = require('../constants');
const { Pool } = require('pg');

class HighAvailabilityService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.otNodeClient = ctx.otNodeClient;
    }

    async startHighAvailabilityNode() {
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
                        // todo add some kind of notification - add log, connect to papertrail
                        process.exit(1);
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await this.sleepForMiliseconds(fallback_sync_attempts_delay);
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

        const activeNode = nodeStatuses.filter(nodeStatus =>
            nodeStatus.hostname === this.config.high_availability.private_hostname);

        await this.updateOrCreateNodeState(
            activeNode,
            constants.NODE_STATUS.active,
            this.config.high_availability.private_hostname,
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
            active_node_data_sync_interval,
            is_remote_node_available_attempts_delay,
        } = this.config.high_availability;
        await this.getMasterNodeData(this.config.high_availability.remote_hostname);

        await this.graphStorage.startReplication();
        this.startPostgresReplication(this.config.high_availability.remote_ip_address);
        let remoteNodeAvailable = true;
        const refreshIntervalId = setInterval(
            async () => {
                if (remoteNodeAvailable) {
                    await this.getMasterNodeData(this.config.high_availability.remote_hostname);
                }
            },
            active_node_data_sync_interval, // read from configuration set 12h
        );
        do {
            // eslint-disable-next-line no-await-in-loop
            await this.sleepForMiliseconds(is_remote_node_available_attempts_delay);
            // eslint-disable-next-line no-await-in-loop
            remoteNodeAvailable = await this.isRemoteNodeAvailable();
        } while (remoteNodeAvailable);
        this.logger.notify('Remote node not available taking over');
        clearInterval(refreshIntervalId);
        this.restartRemoteNode(this.config.high_availability.remote_ip_address);
    }

    async restartRemoteNode(remoteNodeHostname) {
        const remoteNodeStatus = await this.fetchNodeStatus(remoteNodeHostname);

        if (remoteNodeStatus && remoteNodeStatus === constants.NODE_STATUS.updating) {
            this.logger.trace('Remote node is in update process, skipping node restart');
            return;
        }

        exec(`ssh root@${remoteNodeHostname} "docker restart otnode"`, (error, stdout, stderr) => {
            if (error) {
                console.log(`Unable to restart remote node error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`Unable to restart remote node error: ${stderr}`);
                return;
            }
            this.logger.trace('Remote node restarted');
        });
    }

    async fetchNodeStatus(hostname) {
        const pool = new Pool({
            user: 'ot_node',
            host: 'localhost',
            database: 'ot_node_db',
            password: 'origintrail',
            port: 5432,
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
    }

    startPostgresReplication(remoteHostname) {
        this.logger.trace('Starting postgres replication');
        execSync('/etc/init.d/postgresql stop');
        if (fs.existsSync('/var/lib/postgresql/12/main')) {
            execSync('rm -rfv /var/lib/postgresql/12/main/*');
        }
        execSync(`su -c "pg_basebackup -h ${remoteHostname} -U ot_node -p 5432 -D /var/lib/postgresql/12/main/  -Fp -Xs -P -R" - postgres`);
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
        } = this.config.high_availability;

        for (let i = 0; i < is_remote_node_available_attempts_number; i += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const response = await this.otNodeClient.healthCheck(
                    remote_hostname,
                    is_remote_node_available_attempts_timeout,
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
                await this.sleepForMiliseconds(is_remote_node_available_attempts_delay);
            }
        }
        this.logger.info('Remote node is not in active state.');
        return false;
    }

    async sleepForMiliseconds(timeout) {
        await new Promise((resolve, reject) => {
            setTimeout(() => resolve(), timeout); // todo move to configuration
        });
    }
}

module.exports = HighAvailabilityService;

