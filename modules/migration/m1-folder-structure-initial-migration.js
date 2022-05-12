const fs = require('fs-extra');
const appRootPath = require('app-root-path');
const path = require('path');
const { exec } = require('child_process');
const pjson = require('../../package.json');
const BaseMigration = require('./base-migration');

const CONFIGURATION_NAME = '.origintrail_noderc';

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
            const newTemporaryAppDirectoryPath = path.join(temporaryAppRootPath, currentVersion);
            await fs.ensureDir(newTemporaryAppDirectoryPath);

            const currentAppRootPath = appRootPath.path;

            await fs.copy(currentAppRootPath, newTemporaryAppDirectoryPath);

            await fs.remove(currentAppRootPath);

            await fs.rename(temporaryAppRootPath, currentAppRootPath);

            const newAppDirectoryPath = path.join(currentAppRootPath, currentVersion);

            const currentSymlinkFolder = path.join(currentAppRootPath, 'current');
            if (await fs.pathExists(currentSymlinkFolder)) {
                await fs.remove(currentSymlinkFolder);
            }
            await fs.ensureSymlink(newAppDirectoryPath, currentSymlinkFolder, 'folder');

            const oldConfigurationPath = path.join(newAppDirectoryPath, CONFIGURATION_NAME);
            const newConfigurationPath = path.join(currentAppRootPath, CONFIGURATION_NAME);
            await fs.move(oldConfigurationPath, newConfigurationPath);

            const otnodeServicePath = path.join(
                newAppDirectoryPath,
                'installer',
                'data',
                'otnode.service',
            );
            try {
                await this.updateOtNodeService(otnodeServicePath);
            } catch (error) {
                this.logger.warn('Unable to apply new ot-node service file please do it manually!');
            }

            await this.finalizeMigration(path.join(currentAppRootPath, 'data', 'migrations'));
            this.logger.info('Folder structure migration completed, node will now restart!');
            process.exit(1);
        } else {
            this.logger.info(
                `Folder structure initial migration skipped for env: ${process.env.NODE_ENV}`,
            );
        }
    }

    async updateOtNodeService(otnodeServicePath) {
        return new Promise((resolve, reject) => {
            const command = `cp ${otnodeServicePath} /lib/systemd/system/ && systemctl daemon-reload`;
            this.logger.trace(
                `Copy and apply new otnode service file. Running the command: ${command}`,
            );
            const child = exec(command);

            child.stderr.on('data', (data) => {
                reject(data);
            });
            child.stdout.on('end', () => {
                resolve();
            });
        });
    }
}

module.exports = M1FolderStructureInitialMigration;
