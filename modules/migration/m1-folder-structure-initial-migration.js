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
        if (process.env.NODE_ENV === 'testnet' || process.env.NODE_ENV === 'mainnet') {
            if (await this.migrationAlreadyExecuted()) {
                return;
            }

            const currentVersion = pjson.version;
            const temporaryAppRootPath = path.join(appRootPath.path, '..', 'ot-node-tmp');
            const newAppDirectoryPath = path.join(temporaryAppRootPath, currentVersion);
            await fs.ensureDir(newAppDirectoryPath);

            const currentAppRootPath = appRootPath.path;

            await fs.copy(currentAppRootPath, newAppDirectoryPath);

            const indexSymlinkPath = path.join(temporaryAppRootPath, 'index.js');
            const indexPath = path.join(newAppDirectoryPath, 'index.js');

            if (fs.pathExists(indexSymlinkPath)) {
                await fs.remove(indexSymlinkPath);
            }
            await fs.ensureSymlink(indexPath, indexSymlinkPath);

            await fs.remove(currentAppRootPath);

            await fs.rename(temporaryAppRootPath, currentAppRootPath);

            await this.finalizeMigration(path.join(currentAppRootPath, 'data', 'migrations'));
            this.logger.info('Folder structure migration completed, node will now restart!');
            process.exit(1);
        } else {
            this.logger.info(
                `Folder structure initial migration skipped for env: ${process.env.NODE_ENV}`,
            );
        }
    }
}

module.exports = M1FolderStructureInitialMigration;
