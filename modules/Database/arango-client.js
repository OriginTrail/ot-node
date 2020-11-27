const axios = require('axios');

class ArangoClient {
    constructor(selectedDatabase, logger) {
        this.logger = logger;
        this.baseUrl = `http://${selectedDatabase.host}:${selectedDatabase.port}/_db/${selectedDatabase.database}`;

        this.defaultApplierConfiguration = {
            endpoint: `tcp://${selectedDatabase.replication_info.endpoint}:${selectedDatabase.replication_info.port}`,
            username: `${selectedDatabase.replication_info.username}`,
            password: `${selectedDatabase.replication_info.password}`,
            database: 'origintrail',
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
        return response.data;
    }

    async setupReplicationApplierConfiguration(applierConfiguration
    = this.defaultApplierConfiguration) {
        const response = await axios.put(`${this.baseUrl}/_api/replication/applier-config`, applierConfiguration)
            .catch((err) => {
                this.logger.error('Failed to setup Arango replication applier. Error: ', err);
                throw err;
            });
        return response.data;
    }

    async startReplicationApplier() {
        const response = await axios.put(`${this.baseUrl}/_api/replication/applier-start`)
            .catch((err) => {
                this.logger.error('Failed to start Arango replication applier. Error: ', err);
                throw err;
            });
        return response.data;
    }

    async getReplicationApplierState() {
        const response = await axios.get(`${this.baseUrl}/_api/replication/applier-state`)
            .catch((err) => {
                this.logger.error('Failed to fetch state of Arango replication applier. Error: ', err);
                throw err;
            });
        return response.data;
    }

    async stopReplicationApplier() {
        const response = await axios.put(`${this.baseUrl}/_api/replication/applier-stop`)
            .catch((err) => {
                this.logger.error('Failed to stop Arango replication applier. Error: ', err);
                throw err;
            });
        return response.data;
    }
}

module.exports = ArangoClient;
