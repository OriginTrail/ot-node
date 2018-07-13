const AutoUpdater = require('auto-updater');
const Utilities = require('./modules/Utilities');
var npm = require('npm-cmd');

const log = Utilities.getLogger();

class AutoUpdate {
    static update() {
        return new Promise(async (resolve, reject) => {
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
                log.warn("You have a clone of the repository. Use 'git pull' to be up-to-date");
                resolve(true);
            });
            autoupdater.on('check.up-to-date', (v) => {
                log.info(`You have the latest version: ${v}`);
                resolve(true);
            });
            autoupdater.on('check.out-dated', (v_old, v) => {
                log.warn(`Your version is outdated. ${v_old} of ${v}`);
                autoupdater.fire('download-update'); // If autoupdate: false, you'll have to do this manually.
            // Maybe ask if the'd like to download the update.
            });
            autoupdater.on('update.downloaded', () => {
                log.warn('Update downloaded and ready for install');
                autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
            });
            autoupdater.on('update.not-installed', () => {
                log.warn("The Update was already in your folder! It's ready for install");
                autoupdater.fire('extract'); // If autoupdate: false, you'll have to do this manually.
            });
            autoupdater.on('update.extracted', () => {
                log.warn('Update extracted successfully!');


                npm.install([], {
                    cwd: '/ot-node',
                    save: true,
                }, (err) => {
                    if (err) {
                        console.log(err);
                        log.error('Installation failed.');
                    } else {
                        log.info('Installation succeeded!');
                        log.warn('RESTARTING THE APP!');
                        this.restartNode();
                    }
                });
            });
            autoupdater.on('download.start', (name) => {
                log.warn(`Starting downloading: ${name}`);
            });
            autoupdater.on('download.progress', (name, perc) => {
                process.stdout.write(`Downloading ${perc}% \x1B[0G`);
            });
            autoupdater.on('download.end', (name) => {
                log.warn(`Downloaded ${name}`);
            });
            autoupdater.on('download.error', (err) => {
                log.error(`Error when downloading: ${err}`);
                resolve(true);
            });
            autoupdater.on('end', () => {
                log.warn('The app is ready to function');
                resolve(true);
            });
            autoupdater.on('error', (name, e) => {
                log.error(name, e);
                resolve(true);
            });

            // Start checking
            autoupdater.fire('check');
        });
    }
    restartNode() {
        setTimeout(() => {
            process.on('exit', () => {
                /* eslint-disable-next-line */
                require('child_process').spawn(process.argv.shift(), process.argv, {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: 'inherit',
                });
            });
            process.exit(0);
        }, 5000);
    }
}

module.exports = AutoUpdate;
