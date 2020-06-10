const Utilities = require('../Utilities');
const { execSync } = require('child_process');

const fs = require('fs');
const path = require('path');

/**
 * Changes the arango password to a randomly generated one
 */
class M5ArangoPasswordMigration {
    constructor({
        config, log,
    }) {
        this.config = config;
        this.log = log;
    }

    /**
     * Run migration
     */
    async run() {
        try {
            execSync('cp ./scripts/update-arango-password.sh ./');
            execSync('chmod +x update-arango-password.sh');
            execSync(`./update-arango-password.sh ${this.config.appDataPath} ${this.config.database.host} ${this.config.database.port}`, { stdio: 'inherit' });
            execSync('rm ./update-arango-password.sh');
            return 0;
        } catch (error) {
            this.log.error('Arango password update migration failed!');
            this.log.error(error);
            return -1;
        }
    }
}

module.exports = M5ArangoPasswordMigration;
