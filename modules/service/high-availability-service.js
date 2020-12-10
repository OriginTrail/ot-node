const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class HighAvailabilityService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.otNodeClient = ctx.otNodeClient;
    }

    async startHighAvailabilityNode(forkedStatusCheck) {
        const masterNodeAvailable = await this.isRemoteNodeAvailable();
        if (masterNodeAvailable) {
            this.logger.notify('Entering busy wait loop');

            await this.getMasterNodeData(this.config.high_availability.remote_hostname);
            await this.graphStorage.startReplication();
            this.startPostgresReplication(this.config.high_availability.remote_hostname);
            let doWhile = true;
            do {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve, reject) => {
                    setTimeout(() => resolve(), 2000);
                });
                // eslint-disable-next-line no-await-in-loop
                doWhile = await this.isRemoteNodeAvailable();
            } while (doWhile);
            this.logger.notify('Remote node not available taking over');
            this.restartRemoteNode(this.config.high_availability.remote_hostname);
        }
        this.logger.info('Starting as active node');
        this.stopPostgresReplication();
        const replicationState = await this.graphStorage.getReplicationApplierState();
        if (replicationState.state.running) {
            await this.graphStorage.stopReplication();
        }
    }

    restartRemoteNode(remoteNodeHostname) {
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
            this.logger.error(`Failed to synchronize with master node. Error message: ${e.message}`);
        }
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
        this.logger.trace('Stopping postgres replication');
        execSync('pg_ctlcluster 12 main promote');
        this.logger.trace('Postgres replication stopped successfully');
    }

    async isRemoteNodeAvailable() {
        const remoteHostname = this.config.high_availability.remote_hostname;
        const retries = 3;

        for (let i = 0; i < retries; i += 1) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const response = await this.otNodeClient.healthCheck(remoteHostname, 3000);
                if (response.statusCode === 200) {
                    return true;
                }
                this.logger.trace('Remote node is not in active state. attempt: ', i + 1);
            } catch (error) {
                this.logger.trace(`Unable to fetch health check for remote node error: ${error.message}, attempt: ${i + 1}`);
            }
            if (i + 1 < retries) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve, reject) => {
                    setTimeout(() => resolve(), 2000); // todo move to configuration
                });
            }
        }
        this.logger.info('Remote node is not in active state.');
        return false;
    }
}

module.exports = HighAvailabilityService;

