const Utilities = require('../Utilities');
const { execSync } = require('child_process');

const fs = require('fs');
const path = require('path');

/**
 * Changes the arango password to a randomly generated one
 */
class M5ArangoPasswordMigration {
    constructor({
        config,
    }) {
        this.config = config;
    }

    /**
     * Run migration
     */
    async run() {
        execSync('cp ./scripts/update-arango-password.sh ./');
        execSync('chmod +x update-arango-password.sh');
        execSync(`./update-arango-password.sh ${this.config.appDataPath} ${this.config.database.host} ${this.config.database.port}`, { stdio: 'inherit' });
        execSync('rm ./update-arango-password.sh');
    }
}

module.exports = M5ArangoPasswordMigration;
