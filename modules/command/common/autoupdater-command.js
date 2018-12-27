const fs = require('fs');
const semver = require('semver');
const path = require('path');
const request = require('superagent');
const { fork } = require('child_process');

const pjson = require('../../../package');
const Command = require('../command');

/**
 * Increases approval for Bidding contract on blockchain
 */
class AutoupdaterCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.commandResolver = ctx.commandResolver;
        this.notifyEvent = ctx.notifyEvent;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        if (process.env.OT_NODE_DISTRIBUTION !== 'docker') {
            this.logger.warn('Checking for new node version supported only in docker.');
            return Command.empty();
        }

        this.logger.info('Checking for new node version');
        const { config } = this;

        const currentVersion = pjson.version;
        const remoteVersion = await this.__getVersion();

        this.logger.trace(`Version check: local version ${currentVersion}, remote version: ${remoteVersion}`);

        if (semver.lt(currentVersion, remoteVersion)) {
            this.logger.info('New version found');

            const updater = fork(path.join(__dirname, '..', '..', '..', 'testnet', 'prepare-update.js'), [], {
                stdio: [0, 1, 2, 'ipc'],
                env: process.env,
            });

            const updaterPromise = new Promise(async (accept, reject) => {
                updater.on('message', async (result) => {
                    if (result.status !== 'completed') {
                        // Something went wrong.
                        this.logger.warn(`Failed to prepare update. Status: ${result.status}.`);
                        this.notifyEvent(Error(`Failed to prepare update. Status: ${result.status}.`));
                        accept();
                    }
                    /*
                    { status: 'completed',
                      installDir: '/ot-node/2.0.33',
                      version: '2.0.33' }
                     */
                    this.logger.info(`Update ready for version ${result.version}, restarting node...`);
                    fs.writeFileSync('/ot-node/current/UPDATE', JSON.stringify({
                        version: result.version,
                        path: result.installDir,
                        configPath: config.appDataPath,
                    }));

                    // Force restarting the docker container.
                    process.exit(4);
                }).on('error', (error) => {
                    this.logger.error(`Failed to check prepare update. ${error}`);
                    this.notifyEvent(error);
                    accept();
                });
            });

            const options = {
                appDataPath: config.appDataPath,
                version: remoteVersion,
                archiveUrl: config.archiveUrl,
                destinationBaseDir: '/ot-node/',
            };

            updater.send([options]);
            await updaterPromise;
            return Command.repeat();
        }

        this.logger.info('No new version found');
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
            period: 2 * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }

    /**
     * Returns version of the OT node on remote server.
     * @return {Promise.<string>}
     * @private
     */
    __getVersion() {
        return new Promise((resolve, reject) => {
            request.get(this.config.autoUpdater.packageJsonUrl).then((res, err) => {
                if (err) {
                    reject(err);
                    return;
                }
                const response = res.res.text;
                const packageJsonContent = JSON.parse(response);
                resolve(packageJsonContent.version);
            }).catch((err) => {
                reject(err);
            });
        });
    }
}

module.exports = AutoupdaterCommand;
