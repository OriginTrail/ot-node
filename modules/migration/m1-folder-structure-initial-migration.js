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

            const currentSymlink = path.join(appRootPath.path, '..', 'current');
            if (await fs.pathExists(currentSymlink)) {
                await this.finalizeMigration();
                return;
            }

            const currentVersion = pjson.version;
            const temporaryAppRootPath = path.join(appRootPath.path, '..', 'ot-node-tmp');
            const newAppDirectoryPath = path.join(temporaryAppRootPath, currentVersion);
            await fs.ensureDir(newAppDirectoryPath);

            const currentAppRootPath = appRootPath.path;

            await fs.copy(currentAppRootPath, newAppDirectoryPath);

            await fs.remove(currentAppRootPath);

            await fs.rename(temporaryAppRootPath, currentAppRootPath);

            const currentSymlinkFolder = path.join(currentAppRootPath, 'current');
            if (await fs.pathExists(currentSymlinkFolder)) {
                await fs.remove(currentSymlinkFolder);
            }
            await fs.ensureSymlink(newAppDirectoryPath, currentSymlinkFolder, 'folder');

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
