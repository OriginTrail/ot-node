const AutoUpdater = require('auto-updater');
const rimraf = require('rimraf');
const npm = require('npm-cmd');
const Utilities = require('./modules/Utilities');

const log = require('./modules/logger');

const Umzug = require('umzug');

const Models = require('./models');

const umzug_migrations = new Umzug({

    storage: 'sequelize',

    storageOptions: {
        sequelize: Models.sequelize,
        tableName: 'sequelize_meta',
    },

    migrations: {
        params: [Models.sequelize.getQueryInterface(), Models.sequelize.constructor, () => {
            throw new Error('Migration tried to use old style "done" callback. Please upgrade to "umzug" and return a promise instead.');
        }],
        path: './migrations',
        pattern: /\.js$/,
    },

});

class AutoUpdate {
    /**
     * Check for the update.
     * @param {String} [options.repo] - Github repo name i.e. OriginTrail/ot-node.
     * @param {String} [options.branch] - Github repo's branch.
     * @returns {Promise}
     */
    static update(options) {
        return new Promise(async (resolve) => {
            var autoupdater = new AutoUpdater({
                pathToJson: '',
                repo: options.repo,
                branch: options.branch,
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
                        umzug_migrations.up().then((migrations) => {
                            log.warn('Database migrated.');
                            this.restartNode();
                        });
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
    static restartNode() {
        setTimeout(() => {
            process.on('exit', () => {
                /* eslint-disable-next-line */
                require('child_process').spawn(process.argv.shift(), process.argv, {
                    cwd: process.cwd(),
                    detached: true,
                    stdio: 'inherit',
                });
            });
            process.exit(3);
        }, 5000);
    }
}

module.exports = AutoUpdate;
