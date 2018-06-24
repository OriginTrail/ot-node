var AutoUpdater = require('auto-updater');


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
    console.log("You have a clone of the repository. Use 'git pull' to be up-to-date");
});
autoupdater.on('check.up-to-date', (v) => {
    console.info(`You have the latest version: ${v}`);
});
autoupdater.on('check.out-dated', (v_old, v) => {
    console.warn(`Your version is outdated. ${v_old} of ${v}`);
    autoupdater.fire('download-update'); // If autoupdate: false, you'll have to do this manually.
    // Maybe ask if the'd like to download the update.
});
autoupdater.on('update.downloaded', () => {
    console.log('Update downloaded and ready for install');
    autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
});
autoupdater.on('update.not-installed', () => {
    console.log("The Update was already in your folder! It's ready for install");
    autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
});
autoupdater.on('update.extracted', () => {
    console.log('Update extracted successfully!');
    console.warn('RESTART THE APP!');
});
autoupdater.on('download.start', (name) => {
    console.log(`Starting downloading: ${name}`);
});
autoupdater.on('download.progress', (name, perc) => {
    process.stdout.write(`Downloading ${perc}% \x1B[0G`);
});
autoupdater.on('download.end', (name) => {
    console.log(`Downloaded ${name}`);
});
autoupdater.on('download.error', (err) => {
    console.error(`Error when downloading: ${err}`);
});
autoupdater.on('end', () => {
    console.log('The app is ready to function');
});
autoupdater.on('error', (name, e) => {
    console.error(name, e);
});

// Start checking
autoupdater.fire('check');
