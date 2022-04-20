
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

module.exports = class OTAutoUpdater {
    /** 
     * @param config - Configuration for AutoUpdater
     * @param {String} config.branch - The branch to update from. Defaults to master.
     * @param {String} config.tempLocation - The local dir to save temporary information for Auto Git Update.
     * @param {String} config.executeOnComplete - A command to execute after an update completes. Good for restarting the app.
     */
    constructor(config) {
        this.config = config;
    }

    initialize(logger) {
        if (!this.config) throw new Error('You must pass a config object to AutoUpdater.');
        if (!this.config.branch) this.config.branch = 'master';
        if (!this.config.tempLocation) throw new Error('You must define a temp location for cloning the repository');
        this.logger = logger;
    }

    /**
     * Checks local version against the remote version and updates if different. 
     */
    async autoUpdate() {
        const versionCheck = await this.compareVersions();
        if (versionCheck.upToDate) {
            return true
        };
        const update = await this.forceUpdate();
        return update;
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
            const currentVersion = this.readAppVersion();
            const remoteVersion = await this.readRemoteVersion();
            this.logger.info(`AutoUpdater - Current version: ${currentVersion}`);
            this.logger.info(`AutoUpdater - Remote Version: ${remoteVersion}`);
            if (currentVersion === remoteVersion) {
                return {
                    upToDate: true, 
                    currentVersion
                };
            };
            return {
                upToDate: false, 
                currentVersion, 
                remoteVersion
            };
        }catch(e) {
            this.logger.error(`AutoUpdater - Error comparing local and remote versions. Error message: ${e.message}`);
            return {
                upToDate: false, 
                currentVersion: 'Error', 
                remoteVersion: 'Error'
            }
        }
    }

    /**
     * Clones the git repository and installs the update over the local application.
     * A backup of the application is created before the update is installed.
     * If configured, a completion command will be executed and the process for the app will be stopped. 
     * @returns {Boolean} The result of the update.
     */
    async forceUpdate() {
        try {
            this.logger.info(`AutoUpdater - Updating ot-node from ${REPOSITORY_URL}`);
            await this.downloadUpdate();
            await this.backup();
            await this.installUpdate();
            await this.installDependencies();
            this.logger.info('AutoUpdater - Finished installing updated version.');
            if (this.config.executeOnComplete) await this.promiseBlindExecute(this.config.executeOnComplete);
            process.exit(1);
        }catch(e) {
            this.logger.error(`AutoUpdater - Error updating application. Error message: ${e.message}`);
            return false;
        }
    }

    /**
     * Copy the files to the app directory, and install new modules
     * The update is installed from  the configured tempLocation.
     */
    async installUpdate() {
        const source = path.join(this.config.tempLocation, CLONE_SUBDIRECTORY);
        const destination = appRootPath.path;
        this.logger.info('AutoUpdater - Installing update...');
        this.logger.info(`AutoUpdater - Source: ${source}`);
        this.logger.info(`AutoUpdater - Destination: ${destination}`);
        await fs.ensureDir(destination);
        await fs.copy(source, destination);
        return true;
    }

    /**
     * Reads the applications version from the package.json file.
     */
    readAppVersion() {
        const file = path.join(appRootPath.path, 'package.json');
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
            const req = https.request(url, options, res => {
                let body = '';
                res.on('data', data => {body += data});
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
        const options = {}
        let url =  `${REPOSITORY_URL}/${this.config.branch}/package.json`;
        if (url.includes('github')) url = url.replace('github.com', 'raw.githubusercontent.com');
        this.logger.info(`AutoUpdater - Reading remote version from ${url}`);
        
        try {
            const body = await this.promiseHttpsRequest(url, options);
            const remotePackage = JSON.parse(body);
            const {version} = remotePackage;
            return version;
        } catch(e) {
            this.logger.error(`This repository requires a token or does not exist. Error message: ${e.message}`);
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
        await fs.copy(appRootPath.path, destination, {dereference: true});
        return true;
    }

    async downloadUpdate() {
        const destination = path.join(this.config.tempLocation, CLONE_SUBDIRECTORY);
        this.logger.info(`AutoUpdater - Cloning ${REPOSITORY_URL}`);
        this.logger.info(`AutoUpdater - Destination: ${destination}`);
        await fs.ensureDir(destination);
        await fs.emptyDir(destination);
        await this.promiseClone(REPOSITORY_URL, destination, this.config.branch);
        return true;
    }

    /**
    * Runs npm install to update/install the application dependencies.
    */
    installDependencies() {
        return new Promise((resolve, reject) => {
            const destination = appRootPath.path;
            this.logger.info(`AutoUpdater - Installing application dependencies in ${destination}`);
            
            const command = `cd ${destination} && npm install --omit=dev`;
            const child = exec(command);

            
            child.stdout.on('end', resolve);
            child.stdout.on('data', data => this.logger.info(`AutoUpdater - npm install --omit=dev: ${data.replace(/\r?\n|\r/g, '')}`));
            child.stderr.on('data', data => {
                if (data.toLowerCase().includes('error')) {
                    // npm passes warnings as errors, only reject if "error" is included
                    data = data.replace(/\r?\n|\r/g, '');
                    this.logger.error(`AutoUpdater - Error installing dependencies. Error message: ${data}`);
                    reject();
                } else {
                    this.logger.warn(`AutoUpdater - ${data}`);
                }
            });
        });
    }
}