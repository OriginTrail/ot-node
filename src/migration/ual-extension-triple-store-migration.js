/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import { TRIPLE_STORE } from '../constants/constants.js';

const CHAIN_IDS = {
    development: 31337,
    test: 31337,
    devnet: 2160,
    testnet: 20430,
    mainnet: 2043,
};
const chainId = CHAIN_IDS[process.env.NODE_ENV];

class UalExtensionTripleStoreMigration extends BaseMigration {
    constructor(migrationName, logger, config, tripleStoreService) {
        super(migrationName, logger, config);
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        const oldBlockchainId = this.getOldBlockchainId();
        const newBlockchainId = `${oldBlockchainId}:${chainId}`;

        const chunkSize = 10000;

        for (const repository in TRIPLE_STORE.REPOSITORIES) {
            const getUalListQuery = `
            PREFIX schema: <http://schema.org/>
                SELECT DISTINCT ?subject ?object
                WHERE {
                   ?subject schema:assertion ?object .
                }`;

            const ualList = await this.tripleStoreService.select(
                TRIPLE_STORE.REPOSITORIES[repository],
                getUalListQuery,
            );

            this.logger.info(
                `Ual extension triple store migration: found ${ualList.length} distinct UALs in ${repository}`,
            );
            const subjectsSet = new Set(ualList.map((item) => item.subject));
            const newTriples = [];
            for (const { subject: ual, object: assertionId } of ualList) {
                if (assertionId.startsWith('assertion:')) {
                    let newUal;
                    if (ual.includes(newBlockchainId)) {
                        newUal = ual.replace(newBlockchainId, oldBlockchainId);
                    } else {
                        newUal = ual.replace(oldBlockchainId, newBlockchainId);
                    }
                    if (!subjectsSet.has(newUal)) {
                        newTriples.push(`<${newUal}> schema:assertion <${assertionId}>`);
                    }
                }
            }

            while (newTriples.length) {
                const triplesForInsert = newTriples.splice(0, chunkSize);
                const insertQuery = `
                    PREFIX schema: <http://schema.org/>
                    INSERT DATA {
                    GRAPH <assets:graph> { 
                        ${triplesForInsert.join(' .\n')}
                    }
                }`;
                await this.tripleStoreService.queryVoid(
                    TRIPLE_STORE.REPOSITORIES[repository],
                    insertQuery,
                );
                this.logger.info(
                    `Inserted ${triplesForInsert.length} triples, left for insert: ${newTriples.length} repository: ${repository}`,
                );
            }
            this.logger.info(`Finished processing of UALs in repository: ${repository}`);
        }
    }

    getOldBlockchainId() {
        let oldBlockchainId;
        if (this.config.modules.blockchain.implementation) {
            for (const implementationName in this.config.modules.blockchain.implementation) {
                if (this.config.modules.blockchain.implementation[implementationName].enabled) {
                    oldBlockchainId = implementationName;
                }
            }
        }
        if (!oldBlockchainId) {
            throw Error('Unable to find old blockchain id in configuration');
        }
        return oldBlockchainId.split(':')[0];
    }
}

export default UalExtensionTripleStoreMigration;
