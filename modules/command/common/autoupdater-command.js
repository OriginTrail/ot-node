const Command = require('../command');
const Models = require('../../../models/index');
const packageJSON = require('../../../package');
const semver = require('semver');
const path = require('path');
const { fork, spawn, execSync } = require('child_process');
const Utilities = require('../../Utilities');

/**
 * Increases approval for Bidding contract on blockchain
 */
class AutoupdaterCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        this.logger.info('Checking for new node version');
        const { config } = this;

        const currentVersion = packageJSON.version;
        Utilities.getVersion(config.autoUpdater.branch).then((gitVersion) => {
            if (semver.lt(currentVersion, gitVersion)) {
                const updater = fork(path.join(__dirname, '..', '..', '..', 'autoupdater.js'), [], {
                    stdio: [0, 1, 2, 'ipc'],
                    env: process.env,
                });

                this.logger.info('New version found');

                updater.on('message', (msg) => {
                    this.logger.info('Update complete, restarting node...');

                    process.argv.shift();
                    spawn('/ot-node/current/ot-node.js', process.argv, {
                        // cwd: process.cwd(),
                        detached: true,
                        stdio: 'inherit',
                    });

                    execSync('shutdown -r now');
                });

                const options = {};
                options.appDataPath = config.appDataPath;
                options.version = gitVersion;
                options.autoUpdater = config.autoUpdater;

                updater.send([options]);
            } else {
                console.log('No new version found');
            }
        }).catch((err) => {
            this.logger.error('Failed to load version data');
            this.logger.error(err);
        });

        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'autoupdaterCommand',
            data: {
            },
            period: 60 * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = AutoupdaterCommand;
