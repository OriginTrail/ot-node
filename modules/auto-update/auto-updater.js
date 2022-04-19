
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
let logger;
let config;

/**
 * Copy the files to the app directory, and install new modules
 * The update is installed from  the configured tempLocation.
 */
 async function installUpdate() {
    const source = path.join(config.tempLocation, CLONE_SUBDIRECTORY);
    const destination = appRootPath.path;
    logger.info('AutoUpdater - Installing update...');
    logger.info(`AutoUpdater - Source: ${source}`);
    logger.info(`AutoUpdater - Destination: ${destination}`);
    await fs.ensureDir(destination);
    await fs.copy(source, destination);
    return true;
}

/**
 * Reads the applications version from the package.json file.
 */
function readAppVersion() {
    const file = path.join(appRootPath.path, 'package.json');
    logger.info(`AutoUpdater - Reading app version from ${file}`);
    const appPackage = fs.readFileSync(file);
    return JSON.parse(appPackage).version;
}

/**
 * A promise wrapper for sending a get https requests.
 * @param {String} url - The Https address to request.
 * @param {String} options - The request options. 
 */
 function promiseHttpsRequest(url, options) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, res => {
            let body = '';
            res.on('data', data => {body += data});
            res.on('end', () => {
                if (res.statusCode === 200) return resolve(body);
                logger.info(`AutoUpdater - Bad Response ${res.statusCode}`);
                reject(res.statusCode);
            });
        });
        logger.info(`AutoUpdater - Sending request to ${url}`);
        logger.info(`AutoUpdater - Options: ${JSON.stringify(options)}`);
        req.on('error', reject);
        req.end();
    }); 
}

/**
 * Reads the applications version from the git repository.
 */
async function readRemoteVersion() {
    const options = {}
    let url =  `${REPOSITORY_URL}/${config.branch}/package.json`;
    if (url.includes('github')) url = url.replace('github.com', 'raw.githubusercontent.com');
    logger.info(`AutoUpdater - Reading remote version from ${url}`);
    
    try {
        const body = await promiseHttpsRequest(url, options);
        const remotePackage = JSON.parse(body);
        const {version} = remotePackage;
        return version;
    } catch(e) {
        logger.error(`This repository requires a token or does not exist. Error message: ${e.message}`);
    }
}

/**
 * A promise wrapper for the simple-git clone function
 * @param {String} repo - The url of the repository to clone.
 * @param {String} destination - The local path to clone into.
 * @param {String} branch - The repo branch to clone. 
 */
 function promiseClone(repo, destination, branch) {
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
 function promiseBlindExecute(command) {
    return new Promise((resolve) => {
        spawn(command, [], { shell: true, detached: true });
        setTimeout(resolve, 1000);
    });
}

async function backup() {
    const destination = path.join(config.tempLocation, BACKUP_SUBDIRECTORY);
    logger.info(`AutoUpdater - Backing up app to ${destination}`);
    await fs.ensureDir(destination);
    await fs.copy(appRootPath.path, destination, {dereference: true});
    return true;
}

async function downloadUpdate() {
    const destination = path.join(config.tempLocation, CLONE_SUBDIRECTORY);
    logger.info(`AutoUpdater - Cloning ${REPOSITORY_URL}`);
    logger.info(`AutoUpdater - Destination: ${destination}`);
    await fs.ensureDir(destination);
    await fs.emptyDir(destination);
    await promiseClone(REPOSITORY_URL, destination, config.branch);
    return true;
}

/**
* Runs npm install to update/install the application dependencies.
*/
function installDependencies() {
    return new Promise((resolve, reject) => {
        const destination = appRootPath.path;
        logger.info(`AutoUpdater - Installing application dependencies in ${destination}`);
        
        const command = `cd ${destination} && npm install --omit=dev`;
        const child = exec(command);

        
        child.stdout.on('end', resolve);
        child.stdout.on('data', data => logger.info(`AutoUpdater - npm install --omit=dev: ${data.replace(/\r?\n|\r/g, '')}`));
        child.stderr.on('data', data => {
            if (data.toLowerCase().includes('error')) {
                // npm passes warnings as errors, only reject if "error" is included
                data = data.replace(/\r?\n|\r/g, '');
                logger.error(`AutoUpdater - Error installing dependencies. Error message: ${data}`);
                reject();
            } else {
                logger.warn(`AutoUpdater - ${data}`);
            }
        });
    });
}

module.exports = class AutoUpdater {
    /** 
     * @param updateConfig - Configuration for AutoUpdater
     * @param {String} updateConfig.branch - The branch to update from. Defaults to master.
     * @param {String} updateConfig.tempLocation - The local dir to save temporary information for Auto Git Update.
     * @param {String} updateConfig.executeOnComplete - A command to execute after an update completes. Good for restarting the app.
     */
    constructor(updateConfig) {
        config = updateConfig;
        
        if (!config) throw new Error('You must pass a config object to AutoUpdater.');
        if (!config) config.branch = 'master';
        if (!config.tempLocation) throw new Error('You must define a temp location for cloning the repository');
        logger = config.logger;
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
            logger.info('AutoUpdater - Comparing versions...');
            const currentVersion = readAppVersion();
            const remoteVersion = await readRemoteVersion();
            logger.info(`AutoUpdater - Current version: ${currentVersion}`);
            logger.info(`AutoUpdater - Remote Version: ${remoteVersion}`);
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
            logger.error(`AutoUpdater - Error comparing local and remote versions. Error message: ${e.message}`);
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
            logger.info(`AutoUpdater - Updating ot-node from ${REPOSITORY_URL}`);
            await downloadUpdate();
            await backup();
            await installUpdate();
            await installDependencies();
            logger.info('AutoUpdater - Finished installing updated version.');
            if (config.executeOnComplete) await promiseBlindExecute(config.executeOnComplete);
            process.exit(1);
        }catch(e) {
            logger.error(`AutoUpdater - Error updating application. Error message: ${e.message}`);
            return false;
        }
    }
}