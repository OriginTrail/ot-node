// eslint-disable-next-line import/no-extraneous-dependencies
const { Pool } = require('pg');

/**
 * Changes the arango password to a randomly generated one
 */
class M7ArangoDatasetSignatureMigration {
    constructor({ config, graphStorage }) {
        this.config = config;
        this.graphStorage = graphStorage;
    }

    /**
     * Run migration
     */
    async run() {
        const queryString = `for dataset in ot_datasets
UPDATE dataset WITH { signature: [{
type: dataset.signature.type,
proofValue: dataset.signature.value, 
proofPurpose: 'assertionMethod',
created: dataset.datasetHeader.datasetCreationTimestamp,
domain: @blockchain_id
}] } IN ot_datasets`;
        const blockchain_id = this.config.blockchain.implementations[0].network_id;
        await this.graphStorage.runQuery(queryString, { blockchain_id });
    }
}

module.exports = M7ArangoDatasetSignatureMigration;
