const semver = require('semver');
const Command = require('../command');
const constants = require('../../constants');

class OtnodeUpdateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        if (this.config.modules.autoUpdate.enabled) {
            this.updater = ctx.updater;
        }
    }

    /**
     * Performs code update by fetching new code from github repo
     * @param command
     */
    async execute(command) {
        if (!this.config.modules.autoUpdate.enabled) {
            return Command.empty();
        }
        try {
            this.logger.info('Checking for new updates...');
            const {
                upToDate,
                currentVersion,
                remoteVersion,
            } = await this.updater.compareVersions();
            if (!upToDate) {
                if (semver.major(currentVersion) < semver.major(remoteVersion)) {
                    this.logger.info(`New major update available. Please run update to version ${remoteVersion} manually.`);
                    return Command.repeat();
                }
                await this.updater.update();
            }
        } catch (e) {
            await this.handleError(e);
        }
        return Command.repeat();
    }

    async recover(command, err) {
        await this.handleError(err);

        return Command.retry();
    }

    async handleError(error) {
        this.logger.error({
            msg: `Error in update command: ${error}. ${error.stack}`,
            Event_name: constants.ERROR_TYPE.CHECKING_UPDATE_ERROR,
            Event_value1: error.message,
        });
    }

    /**
     * Builds default otnodeUpdateCommand
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
