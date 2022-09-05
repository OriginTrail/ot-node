import BaseModuleManager from '../base-module-manager.js';

class AutoUpdaterModuleManager extends BaseModuleManager {
    getName() {
        return 'autoUpdater';
    }

    /**
     * @typedef VersionResults
     * @param {Boolean} UpToDate - If the local version is the same as the remote version.
     * @param {String} currentVersion - The version of the local application.
     * @param {String} remoteVersion - The version of the application in the git repository.
     *
     * Checks the local version of the application against the remote repository.
     * @returns Promise{VersionResults} - An object with the results of the version comparison.
     */
    async compareVersions() {
        if (this.initialized) {
            return this.getImplementation().module.compareVersions();
        }
    }

    /**
     * Clones the git repository and installs the update over the local application.
     * A backup of the application is created before the update is installed.
     * If configured, a completion command will be executed and the process for the app will be stopped.
     */
    async update() {
        if (this.initialized) {
            return this.getImplementation().module.update();
        }
    }
}

export default AutoUpdaterModuleManager;
