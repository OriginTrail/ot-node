const fs = require('fs-extra');
const appRootPath = require('app-root-path');
const path = require('path');
const pjson = require('../../package.json');
const BaseMigration = require('./base-migration');

class M1FolderStructureInitialMigration extends BaseMigration {
    constructor(logger, config) {
        super('M1FolderStructureInitialMigration', logger, config);
        this.logger = logger;
        this.config = config;
    }

    async run() {
        if (await this.migrationAlreadyExecuted()) {
            return;
        }
        this.logger.info('Starting M1 Folder structure initial migration.');
        if (process.env.NODE_ENV === 'testnet' || process.env.NODE_ENV === 'mainnet') {
            const currentAppRootPath = appRootPath.path;
            const folderStat = await fs.lstat(currentAppRootPath);
            if (folderStat.isSymbolicLink()) {
                this.logger.info(
                    'Symbolic link already created for ot-node, migration will be skipped.',
                );
                await this.finalizeMigration();
                this.logger.info('M1 Folder structure migration completed successfully.');
                return;
            }
            const newAppRootPath = path.join(currentAppRootPath, '..', pjson.version);

            await fs.rename(currentAppRootPath, newAppRootPath);
            await fs.ensureSymlink(newAppRootPath, currentAppRootPath);
            await this.finalizeMigration();
            this.logger.info('M1 Folder structure migration completed successfully.');
        } else {
            this.logger.info(
                'Folder structure initial migration not executed for env: ',
                process.env.NODE_ENV,
            );
        }
    }
}

module.exports = M1FolderStructureInitialMigration;
