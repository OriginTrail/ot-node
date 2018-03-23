var AutoUpdater = require('auto-updater');
const utilities = require('./modules/utilities')();

const log = utilities.getLogger();
var autoupdater = new AutoUpdater({
    pathToJson: '',
    autoupdate: false,
    checkgit: true,
    jsonhost: 'raw.githubusercontent.com',
    contenthost: 'codeload.github.com',
    progressDebounce: 0,
    devmode: false,
});

// State the events
autoupdater.on('git-clone', () => {
    log.info('You have a clone of the repository. Use \'git pull\' to be up-to-date');
});
autoupdater.on('check.up-to-date', (v) => {
    log.info(`You have the latest version: ${v}`);
});
autoupdater.on('check.out-dated', (v_old, v) => {
    log.warn(`Your version is outdated. ${v_old}' of '${v}`);
    autoupdater.fire('download-update'); // If autoupdate: false, you'll have to do this manually.
    // Maybe ask if the'd like to download the update.
});
autoupdater.on('update.downloaded', () => {
    log.info('Update downloaded and ready for install');
    autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
});
autoupdater.on('update.not-installed', () => {
    log.info('The Update was already in your folder! It\'s read for install');
    autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
});
autoupdater.on('update.extracted', () => {
    log.info('Update extracted successfully!');
    log.warn('RESTART THE APP!');
});
autoupdater.on('download.start', (name) => {
    log.info(`Starting downloading: ${name}`);
});
autoupdater.on('download.progress', (name, perc) => {
    process.stdout.write(`Downloading ${perc}% \x33[0G`);
});
autoupdater.on('download.end', (name) => {
    log.info(`Downloaded ${name}`);
});
autoupdater.on('download.error', (err) => {
    log.error(`Error when downloading: ${err}`);
});
autoupdater.on('end', () => {
    log.info('The app is ready to function');
});
autoupdater.on('error', (name, e) => {
    log.error(name, e);
});

// Start checking
autoupdater.fire('check');
