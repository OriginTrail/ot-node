const path = require('path');
const fs = require('fs-extra');
const { exec, execSync } = require('child_process');
const https = require('https');
const appRootPath = require('app-root-path');
const git = require('simple-git');
const semver = require('semver');

const REPOSITORY_URL = 'https://github.com/OriginTrail/ot-node';

class OTAutoUpdater {
    /**
     * @param config - Configuration for AutoUpdater
     * @param {String} config.branch - The branch to update from. Defaults to master.
     */
    constructor(config) {
        this.config = config;
        this.logger = config.logger;
    }

    initialize() {
        if (!this.config) throw new Error('You must pass a config object to AutoUpdater.');
        if (!this.config.branch) this.config.branch = 'master';
    }

    /**
     * @typedef VersionResults
     * @param {Boolean} UpToDate - If the local version is the same as the remote version.
     * @param {String} currentVersion - The version of the local application.
     * @param {String} remoteVersion - The version of the application in the git repository.
     *
     * Checks the local version of the application against the remote repository.
     * @returns {VersionResults} - An object with the results of the version comparison.
     */
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

    /**
     * Clones the git repository and installs the update over the local application.
     * A backup of the application is created before the update is installed.
     * If configured, a completion command will be executed and the process for the app will be stopped.
     */
    async update() {
        try {
            this.logger.debug(`AutoUpdater - Updating ot-node from ${REPOSITORY_URL}`);
            const rootPath = path.join(appRootPath.path, '..');
            const currentDirectory = path.join(rootPath, 'ot-node');
            const currentVersion = this.readAppVersion(appRootPath.path);
            const newVersion = await this.readRemoteVersion();
            const updateDirectory = path.join(rootPath, newVersion);
            await this.downloadUpdate(updateDirectory);
            await this.copyConfigFiles(updateDirectory);
            await this.installDependencies(updateDirectory);

            execSync(`ln -sfn ${updateDirectory} ${currentDirectory}`);

            this.logger.debug('AutoUpdater - Finished installing updated version.');

            await this.removeOldVersions(currentVersion, newVersion);
            const updatedFilePath = path.join(rootPath, 'UPDATED');
            await fs.promises.writeFile(updatedFilePath, '');
            process.exit(1);
        } catch (e) {
            this.logger.error(
                `AutoUpdater - Error updating application. Error message: ${e.message}`,
            );
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
    async copyConfigFiles(destination) {
        this.logger.debug('AutoUpdater - Copying config files...');
        this.logger.debug(`AutoUpdater - Destination: ${destination}`);

        await fs.ensureDir(destination);
        // copy .origintrail_noderc file
        let source = path.join(appRootPath.path, '.origintrail_noderc');
        await fs.copy(source, path.join(destination, '.origintrail_noderc'));
        // copy .env file
        source = path.join(appRootPath.path, '.env');
        await fs.copy(source, path.join(destination, '.env'));

        return destination;
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
            this.logger.debug(`AutoUpdater - Options: ${JSON.stringify(options)}`);
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

    async downloadUpdate() {
        const destination = path.join(appRootPath, '..');
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

            const command = `cd ${destination} && npm install --omit=dev`;
            const child = exec(command);

            child.stdout.on('data', (data) =>
                this.logger.debug(
                    `AutoUpdater - npm install --omit=dev: ${data.replace(/\r?\n|\r/g, '')}`,
                ),
            );
            let resultData;
            child.stderr.on('data', (data) => {
                if (data.toLowerCase().includes('error')) {
                    // npm passes warnings as errors, only reject if "error" is included
                    data = data.replace(/\r?\n|\r/g, '');
                    this.logger.error(
                        `AutoUpdater - Error installing dependencies. Error message: ${data}`,
                    );
                    reject();
                } else {
                    resultData += data;
                }
            });
            child.stdout.on('end', () => {
                resultData = resultData.split('\n');
                resultData = resultData.filter((x) => x !== '');
                for (const data of resultData) {
                    this.logger.warn(`AutoUpdater - ${data}`);
                }
                resolve();
            });
        });
    }
}

module.exports = OTAutoUpdater;
