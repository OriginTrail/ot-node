const axios = require('axios');

class ArangoClient {
    constructor(selectedDatabase) {
        this.baseUrl = `http://${selectedDatabase.host}:${selectedDatabase.port}/_db/${selectedDatabase.database}`;

        this.defaultApplierConfiguration = {
            endpoint: `${selectedDatabase.replication_info.endpoint}:${selectedDatabase.replication_info.port}`,
            username: `${selectedDatabase.replication_info.username}`,
            password: `${selectedDatabase.replication_info.password}`,
            verbose: false,
            includeSystem: false,
            incremental: true,
            autoResync: true,
        };
    }

    async getApplierConfiguration() {
        const response = await axios.get(`${this.baseUrl}/_api/replication/applier-config`)
            .catch((err) => {
                this.logger.error('Failed to fetch Arango replication applier configuration. Error: ', err);
                throw err;
            });
        return response;
    }

    async setupReplicationApplierConfiguration(applierConfiguration
    = this.defaultApplierConfiguration) {
        const response = await axios.put(`${this.baseUrl}/_api/replication/applier-config`, applierConfiguration)
            .catch((err) => {
                this.logger.error('Failed to setup Arango replication applier. Error: ', err);
                throw err;
            });
        return response;
    }

    async startReplicationApplier(global = true) {
        const response = await axios.put(`${this.baseUrl}/_api/replication/applier-start`, { global })
            .catch((err) => {
                this.logger.error('Failed to start Arango replication applier. Error: ', err);
                throw err;
            });
        return response;
    }

    async getReplicationApplierState() {
        const response = await axios.put(`${this.baseUrl}/_api/replication/applier-state`)
            .catch((err) => {
                this.logger.error('Failed to fetch state of Arango replication applier. Error: ', err);
                throw err;
            });
        return response;
    }

    async stopReplicationApplier(global = true) {
        const response = await axios.put(`${this.baseUrl}/_api/replication/applier-stop`, { global })
            .catch((err) => {
                this.logger.error('Failed to stop Arango replication applier. Error: ', err);
                throw err;
            });
        return response;
    }
}

module.exports = ArangoClient;
