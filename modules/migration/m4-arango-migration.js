const Utilities = require('../Utilities');
const { execSync } = require('child_process');

const fs = require('fs');
const path = require('path');

/**
 * Moves old network identity files to a backup folder so that new files can be generated
 */
class M4ArangoMigration {
    constructor({
        logger, config,
    }) {
        this.logger = logger;
        this.config = config;
    }

    /**
     * Run migration
     */
    async run() {
        execSync(
            `arangodump --server.database ${this.config.database.database} ` +
            ` --server.username ${this.config.database.username} ` +
            ` --server.password ${this.config.database.password === '' ? '\'\'' : this.config.database.password} ` +
            ` --output-directory ${path.join(this.config.appDataPath, 'arangodb_backup')} --overwrite true`,
            (error, stdout, stderr) => {
                console.log(`${stdout}`);
                if (error !== null) {
                    console.error(`${error}`);
                    return 1;
                }
                console.log('Backup finished.');
            },
        );

        execSync('chmod +x upgrade-arango.sh');
        execSync(`./upgrade-arango.sh ${this.config.database.password} ${this.config.database.host} ${this.config.database.port}`, { stdio: 'inherit' });
    }
}

module.exports = M4ArangoMigration;
