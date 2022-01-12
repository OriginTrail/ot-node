const Command = require('../command');
const semver = require('semver');

class OtnodeUpdateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        if (this.config.autoUpdate.enabled) {
            this.updater = ctx.updater;
        }
    }

    /**
     * Performs code update by fetching new code from github repo
     * @param command
     */
    async execute(command) {
        if (!this.config.autoUpdate.enabled) {
            return Command.empty();
        }
        try {
            this.logger.info('Checking for new updates...');
            const { upToDate, currentVersion, remoteVersion } = await this.updater.compareVersions();
            if (!upToDate) {
                if (semver.major(currentVersion) < semver.major(remoteVersion)) {
                    this.logger.info(`New major update available. Please run update to version ${remoteVersion} manually.`);
                    return Command.repeat();
                } else {
                    await this.updater.autoUpdate();
                }
            }
        } catch (e) {
            this.logger.error({
                msg: `Error in update command: ${e}`,
                Event_name: 'CheckingUpdateError',
                Event_value1: e.message,
            });
        }
        return Command.repeat();
    }

    /**
     * Builds default UpdateCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'otnodeUpdateCommand',
            delay: 0,
            data: {
                message: '',
            },
            period: 15 * 60 * 1000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OtnodeUpdateCommand;
