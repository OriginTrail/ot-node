const AutoUpdater = require('auto-updater');
const Utilities = require('./Utilities');

const autoupdater = new AutoUpdater({
    pathToJson: '',
    autoupdate: false,
    checkgit: true,
    jsonhost: 'raw.githubusercontent.com',
    contenthost: 'codeload.github.com',
    progressDebounce: 0,
    devmode: false,
});

class Update {
    /**
     * Check for updates
     */
    static checkForUpdates() {
        Update.registerEvents();
        // Start checking
        autoupdater.fire('check');
    }

    /**
     * Register update events
     */
    static registerEvents() {
        this.log = Utilities.getLogger();
        // State the events
        autoupdater.on('git-clone', () => {
            this.log.warn("You have a clone of the repository. Use 'git pull' to be up-to-date");
        });
        autoupdater.on('check.up-to-date', (v) => {
            this.log.info(`You have the latest version: ${v}`);
        });
        autoupdater.on('check.out-dated', (v_old, v) => {
            this.log.warn(`Your version is outdated. ${v_old} of ${v}`);
            autoupdater.fire('download-update'); // If autoupdate: false, you'll have to do this manually.
            // Maybe ask if the'd like to download the update.
        });
        autoupdater.on('update.downloaded', () => {
            this.log.log('Update downloaded and ready for install');
            autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
        });
        autoupdater.on('update.not-installed', () => {
            this.log.log("The Update was already in your folder! It's ready for install");
            autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
        });
        autoupdater.on('update.extracted', () => {
            this.log.log('Update extracted successfully!');
            console.warn('RESTART THE APP!');
        });
        autoupdater.on('download.start', (name) => {
            this.log.log(`Starting downloading: ${name}`);
        });
        autoupdater.on('download.progress', (name, perc) => {
            process.stdout.write(`Downloading ${perc}% \\033[0G`);
        });
        autoupdater.on('download.end', (name) => {
            this.log.log(`Downloaded ${name}`);
        });
        autoupdater.on('download.error', (err) => {
            this.log.error(`Error when downloading: ${err}`);
        });
        autoupdater.on('end', () => {
            this.log.log('The app is ready to function');
        });
        autoupdater.on('error', (name, e) => {
            this.log.error(name, e);
        });
    }
}
module.exports = Update;
