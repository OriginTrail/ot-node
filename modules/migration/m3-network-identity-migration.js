const Utilities = require('../Utilities');
const { execSync } = require('child_process');

const fs = require('fs');
const path = require('path');

/**
 * Moves old network identity files to a backup folder so that new files can be generated
 */
class M3NetworkIdentityMigration {
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
        const identityFilePath = path.join(
            this.config.appDataPath,
            this.config.identity_filepath,
        );

        if (fs.existsSync(identityFilePath)) {
            const identityFileContent =
                JSON.parse(fs.readFileSync(identityFilePath).toString());

            const backupPath = path.join(this.config.appDataPath, 'Node_2_0_59_Identity_Backup');
            const { xprivkey, index } = identityFileContent;
            if ((xprivkey || index) && this.config.autoUpdater.enabled) {
                this.logger.info('Old network identity detected, running code migrations...');

                // Backup data
                if (!fs.existsSync(backupPath)) {
                    execSync(`mkdir ${backupPath}`);

                    try {
                        execSync(`/bin/mv ${path.join(this.config.appDataPath, 'peercache')} ${backupPath}/`);
                        execSync(`/bin/mv ${path.join(this.config.appDataPath, 'kadence.dht')} ${backupPath}/`);
                    } catch (e) {
                        this.logger.debug('peercache and kadence.dht not found');
                    }
                }

                execSync(`/bin/mv ${identityFilePath} ${backupPath}/`);
            }
        }
    }
}

module.exports = M3NetworkIdentityMigration;
