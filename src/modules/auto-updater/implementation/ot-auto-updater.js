const path = require('path');
const fs = require('fs-extra');
const { exec, spawn } = require('child_process');
const https = require('https');
const appRootPath = require('app-root-path');
const git = require('simple-git');
const semver = require('semver');

const REPOSITORY_URL = 'https://github.com/OriginTrail/ot-node';

class OTAutoUpdater {
    initialize(config, logger) {
        this.config = config;
        this.logger = logger;
        if (!this.config) throw new Error('You must pass a config object to AutoUpdater.');
        if (!this.config.branch) this.config.branch = 'master';
    }

    async compareVersions() {
        try {
            this.logger.debug('AutoUpdater - Comparing versions...');
            const currentVersion = this.readAppVersion(appRootPath.path);
            const remoteVersion = await this.readRemoteVersion();
            this.logger.debug(`AutoUpdater - Current version: ${currentVersion}`);
            this.logger.debug(`AutoUpdater - Remote Version: ${remoteVersion}`);
            if (currentVersion === remoteVersion) {
                return {
                    upToDate: true,
                    currentVersion,
                };
            }
            return {
                upToDate: false,
                currentVersion,
                remoteVersion,
            };
        } catch (e) {
            this.logger.error(
                `AutoUpdater - Error comparing local and remote versions. Error message: ${e.message}`,
            );
            return {
                upToDate: false,
                currentVersion: 'Error',
                remoteVersion: 'Error',
            };
        }
    }

    async update() {
        try {
            this.logger.debug(`AutoUpdater - Updating ot-node from ${REPOSITORY_URL}`);
            const currentDirectory = appRootPath.path;
            const rootPath = path.join(currentDirectory, '..');

            const currentVersion = this.readAppVersion(currentDirectory);
            const newVersion = await this.readRemoteVersion();
            const updateDirectory = path.join(rootPath, newVersion);
            await this.downloadUpdate(updateDirectory);
            await this.copyConfigFiles(currentDirectory, updateDirectory);
            await this.installDependencies(updateDirectory);

            const indexPath = path.join(updateDirectory, 'index.js');
            const indexSymlinkPath = path.join(rootPath, 'index.js');
            if (fs.pathExists(indexSymlinkPath)) {
                await fs.remove(indexSymlinkPath);
            }
            await fs.ensureSymlink(indexPath, indexSymlinkPath);

            this.logger.debug('AutoUpdater - Finished installing updated version.');

            await this.removeOldVersions(currentVersion, newVersion);
            return true;
        } catch (e) {
            this.logger.error(
                `AutoUpdater - Error updating application. Error message: ${e.message}`,
            );
            return false;
        }
    }

    async removeOldVersions(currentVersion, newVersion) {
        try {
            const rootPath = path.join(appRootPath.path, '..');

            const oldVersionsDirs = (await fs.promises.readdir(rootPath, { withFileTypes: true }))
                .filter((dirent) => dirent.isDirectory())
                .map((dirent) => dirent.name)
                .filter(
                    (name) => semver.valid(name) && name !== newVersion && name !== currentVersion,
                );
            const deletePromises = oldVersionsDirs
                .map((dirName) => path.join(rootPath, dirName))
                .map((fullPath) => fs.promises.rm(fullPath, { recursive: true, force: true }));

            await Promise.all(deletePromises);
        } catch (e) {
            throw Error('AutoUpdater - There was an error removing old versions');
        }
    }

    /**
     * Copies user config files to destination directory
     */
    async copyConfigFiles(source, destination) {
        this.logger.debug('AutoUpdater - Copying config files...');
        this.logger.debug(`AutoUpdater - Destination: ${destination}`);

        await fs.ensureDir(destination);
        const configurationPath = path.join(source, '.origintrail_noderc');
        const newConfigurationPath = path.join(destination, '.origintrail_noderc');
        await fs.copy(configurationPath, newConfigurationPath);

        const envFilePath = path.join(source, '.env');
        const newEnvFilePath = path.join(destination, '.env');
        await fs.copy(envFilePath, newEnvFilePath);
    }

    /**
     * Reads the applications version from the package.json file.
     */
    readAppVersion(appPath) {
        const file = path.join(appPath, 'package.json');
        this.logger.debug(`AutoUpdater - Reading app version from ${file}`);
        const appPackage = fs.readFileSync(file);
        return JSON.parse(appPackage).version;
    }

    /**
     * A promise wrapper for sending a get https requests.
     * @param {String} url - The Https address to request.
     * @param {String} options - The request options.
     */
    promiseHttpsRequest(url, options) {
        return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let body = '';
                res.on('data', (data) => {
                    body += data;
                });
                res.on('end', () => {
                    if (res.statusCode === 200) return resolve(body);
                    this.logger.warn(`AutoUpdater - Bad Response ${res.statusCode}`);
                    reject(res.statusCode);
                });
            });
            this.logger.debug(`AutoUpdater - Sending request to ${url}`);
            req.on('error', reject);
            req.end();
        });
    }

    /**
     * Reads the applications version from the git repository.
     */
    async readRemoteVersion() {
        const options = {};
        let url = `${REPOSITORY_URL}/${this.config.branch}/package.json`;
        if (url.includes('github')) url = url.replace('github.com', 'raw.githubusercontent.com');
        this.logger.debug(`AutoUpdater - Reading remote version from ${url}`);

        try {
            const body = await this.promiseHttpsRequest(url, options);
            const remotePackage = JSON.parse(body);
            const { version } = remotePackage;
            return version;
        } catch (e) {
            throw new Error(
                `This repository requires a token or does not exist. Error message: ${e.message}`,
            );
        }
    }

    /**
     * A promise wrapper for the simple-git clone function
     * @param {String} repo - The url of the repository to clone.
     * @param {String} destination - The local path to clone into.
     * @param {String} branch - The repo branch to clone.
     */
    promiseClone(repo, destination, branch) {
        return new Promise((resolve, reject) => {
            git().clone(repo, destination, [`--branch=${branch}`], (result) => {
                if (result != null) reject(`Unable to clone repo \n ${repo} \n ${result}`);
                resolve();
            });
        });
    }

    async downloadUpdate(destination) {
        this.logger.debug(`AutoUpdater - Cloning ${REPOSITORY_URL}`);
        this.logger.debug(`AutoUpdater - Destination: ${destination}`);
        await fs.ensureDir(destination);
        await fs.emptyDir(destination);
        await this.promiseClone(REPOSITORY_URL, destination, this.config.branch);
    }

    /**
     * Runs npm install to update/install the application dependencies.
     */
    installDependencies(destination) {
        return new Promise((resolve, reject) => {
            this.logger.debug(
                `AutoUpdater - Installing application dependencies in ${destination}`,
            );

            const command = `cd ${destination} && npm install --omit=dev --ignore-scripts`;
            const child = exec(command);

            child.stdout.on('data', (data) => {
                this.logger.trace(`AutoUpdater - npm install - ${data.replace(/\r?\n|\r/g, '')}`);
            });

            child.stderr.on('data', (data) => {
                if (data.toLowerCase().includes('error')) {
                    // npm passes warnings as errors, only reject if "error" is included
                    const errorData = data.replace(/\r?\n|\r/g, '');
                    this.logger.error(
                        `AutoUpdater - Error installing dependencies. Error message: ${errorData}`,
                    );
                    reject(errorData);
                }
            });
            child.stdout.on('end', () => {
                this.logger.debug(`AutoUpdater - Dependencies installed successfully`);
                resolve();
            });
        });
    }
}

module.exports = OTAutoUpdater;
