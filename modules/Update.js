const logger = require('./logger');

class Update {
    /**
     * Check for updates
     */
    checkForUpdates(autoupdater) {
        this.autoupdater = autoupdater;
        this.registerEvents();
        // Start checking
        this.autoupdater.fire('check');
    }

    /**
     * Register update events
     */
    registerEvents() {
        // State the events
        this.autoupdater.on('git-clone', () => {
            logger.warn("You have a clone of the repository. Use 'git pull' to be up-to-date");
        });
        this.autoupdater.on('check.up-to-date', (v) => {
            logger.info(`You have the latest version of OTNode: ${v}`);
        });
        this.autoupdater.on('check.out-dated', (v_old, v) => {
            logger.warn(`Your OTNode version is outdated. ${v_old} of ${v}`);
            this.autoupdater.fire('download-update'); // If autoupdate: false, you'll have to do this manually.
            // Maybe ask if the'd like to download the update.
        });
        this.autoupdater.on('update.downloaded', () => {
            logger.log('Update downloaded and ready for install');
            this.autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
        });
        this.autoupdater.on('update.not-installed', () => {
            logger.log("The Update was already in your folder! It's ready for install");
            this.autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
        });
        this.autoupdater.on('update.extracted', () => {
            logger.log('Update extracted successfully!');
            console.warn('RESTART THE APP!');
        });
        this.autoupdater.on('download.start', (name) => {
            logger.log(`Starting downloading: ${name}`);
        });
        this.autoupdater.on('download.progress', (name, perc) => {
            process.stdout.write(`Downloading ${perc}% \x1B[0G`);
        });
        this.autoupdater.on('download.end', (name) => {
            logger.log(`Downloaded ${name}`);
        });
        this.autoupdater.on('download.error', (err) => {
            logger.error(`Error when downloading: ${err}`);
        });
        this.autoupdater.on('end', () => {
            logger.log('The app is ready to function');
        });
        this.autoupdater.on('error', (name, e) => {
            logger.error(name, e);
        });
    }
}
module.exports = new Update();
