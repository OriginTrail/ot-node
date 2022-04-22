
const path = require('path');
const fs = require('fs-extra');
const {spawn, exec} = require('child_process');
const https = require('https');
const appRootPath = require('app-root-path');
const git = require('simple-git');

// Subdirectories to use within the configured tempLocation from above. 
const CLONE_SUBDIRECTORY = '/auto-update/repo/';
const BACKUP_SUBDIRECTORY = '/auto-update/backup/';
const REPOSITORY_URL = 'https://github.com/OriginTrail/ot-node';

class OTAutoUpdater {
    /**
     * @param config - Configuration for AutoUpdater
     * @param {String} config.branch - The branch to update from. Defaults to master.
     * @param {String} config.tempLocation - The local dir to save temporary information for Auto Git Update.
     * @param {String} config.executeOnComplete - A command to execute after an update completes. Good for restarting the app.
     */
    constructor(config) {
        this.config = config;
        this.logger = config.logger;
    }

    initialize() {
        if (!this.config) throw new Error('You must pass a config object to AutoUpdater.');
        if (!this.config.branch) this.config.branch = 'master';
        if (!this.config.tempLocation)
            throw new Error('You must define a temp location for cloning the repository');
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
            this.logger.info('AutoUpdater - Comparing versions...');
            const currentVersion = this.readAppVersion(appRootPath.path);
            const remoteVersion = await this.readRemoteVersion();
            this.logger.info(`AutoUpdater - Current version: ${currentVersion}`);
            this.logger.info(`AutoUpdater - Remote Version: ${remoteVersion}`);
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
            this.logger.info(`AutoUpdater - Updating ot-node from ${REPOSITORY_URL}`);
            const currentDirectory = path.join(
                appRootPath.path,
                '..',
                await this.readAppVersion(appRootPath.path),
            );
            await this.downloadUpdate();
            await this.backup();
            const updateDirectory = await this.installUpdate();
            await this.installDependencies(updateDirectory);

            // rename current working directory to issues when creating new link
            const tmpDirectory = path.join(appRootPath.path, '..', 'tmp');
            await fs.rename(appRootPath.path, tmpDirectory);

            // link to update directory
            await fs.ensureSymlink(updateDirectory, 'ot-node');

            // remove old files
            await fs.rm(tmpDirectory, { force: true, recursive: true });
            await fs.rm(currentDirectory, { force: true, recursive: true });
            this.logger.info('AutoUpdater - Finished installing updated version.');
            if (this.config.executeOnComplete)
                await this.promiseBlindExecute(this.config.executeOnComplete);
            process.exit(1);
        } catch (e) {
            this.logger.error(
                `AutoUpdater - Error updating application. Error message: ${e.message}`,
            );
        }
    }

    /**
     * Copy the files to the app directory, and install new modules
     * The update is installed from  the configured tempLocation.
     */
    async installUpdate() {
        let source = path.join(this.config.tempLocation, CLONE_SUBDIRECTORY);
        const newVersion = await this.readAppVersion(source);
        const destination = path.join(appRootPath.path, '..', newVersion);
        this.logger.info('AutoUpdater - Installing update...');
        this.logger.info(`AutoUpdater - Source: ${source}`);
        this.logger.info(`AutoUpdater - Destination: ${destination}`);
        // copy new files
        await fs.ensureDir(destination);
        await fs.copy(source, destination);
        // copy .origintrail_noderc file
        source = path.join(appRootPath.path, '.origintrail_noderc');
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
        this.logger.info(`AutoUpdater - Reading app version from ${file}`);
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
                    this.logger.info(`AutoUpdater - Bad Response ${res.statusCode}`);
                    reject(res.statusCode);
                });
            });
            this.logger.info(`AutoUpdater - Sending request to ${url}`);
            this.logger.info(`AutoUpdater - Options: ${JSON.stringify(options)}`);
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
        this.logger.info(`AutoUpdater - Reading remote version from ${url}`);

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

    /**
     * A promise wrapper for the child-process spawn function. Does not listen for results.
     * @param {String} command - The command to execute.
     */
    promiseBlindExecute(command) {
        return new Promise((resolve) => {
            spawn(command, [], { shell: true, detached: true });
            setTimeout(resolve, 1000);
        });
    }

    async backup() {
        const destination = path.join(this.config.tempLocation, BACKUP_SUBDIRECTORY);
        this.logger.info(`AutoUpdater - Backing up app to ${destination}`);
        await fs.ensureDir(destination);
        await fs.copy(appRootPath.path, destination, { dereference: true });
    }

    async downloadUpdate() {
        const destination = path.join(this.config.tempLocation, CLONE_SUBDIRECTORY);
        this.logger.info(`AutoUpdater - Cloning ${REPOSITORY_URL}`);
        this.logger.info(`AutoUpdater - Destination: ${destination}`);
        await fs.ensureDir(destination);
        await fs.emptyDir(destination);
        await this.promiseClone(REPOSITORY_URL, destination, this.config.branch);
    }

    /**
     * Runs npm install to update/install the application dependencies.
     */
    installDependencies(destination) {
        return new Promise((resolve, reject) => {
            this.logger.info(`AutoUpdater - Installing application dependencies in ${destination}`);

            const command = `cd ${destination} && npm install --omit=dev`;
            const child = exec(command);

            child.stdout.on('end', resolve);
            child.stdout.on('data', (data) =>
                this.logger.info(
                    `AutoUpdater - npm install --omit=dev: ${data.replace(/\r?\n|\r/g, '')}`,
                ),
            );
            child.stderr.on('data', (data) => {
                if (data.toLowerCase().includes('error')) {
                    // npm passes warnings as errors, only reject if "error" is included
                    data = data.replace(/\r?\n|\r/g, '');
                    this.logger.error(
                        `AutoUpdater - Error installing dependencies. Error message: ${data}`,
                    );
                    reject();
                } else {
                    this.logger.warn(`AutoUpdater - ${data}`);
                }
            });
        });
    }
}

module.exports = OTAutoUpdater;