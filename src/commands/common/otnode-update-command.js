const semver = require('semver');
const fs = require('fs-extra');
const Command = require('../command');
const constants = require('../../constants/constants');

class OtnodeUpdateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.autoUpdaterModuleManager = ctx.autoUpdaterModuleManager;
        this.fileService = ctx.fileService;
    }

    /**
     * Performs code update by fetching new code from github repo
     * @param command
     */
    async execute() {
        if (!this.config.modules.autoUpdater.enabled) {
            return Command.empty();
        }
        try {
            this.logger.info('Checking for new updates...');
            const { upToDate, currentVersion, remoteVersion } =
                await this.autoUpdaterModuleManager.compareVersions();
            if (!upToDate) {
                if (semver.major(currentVersion) < semver.major(remoteVersion)) {
                    this.logger.info(
                        `New major update available. Please run update to version ${remoteVersion} manually.`,
                    );
                    return Command.repeat();
                }
                if (semver.lt(semver.valid(remoteVersion), semver.valid(currentVersion))) {
                    this.logger.info(
                        'Remote version less than current version, update will be skipped',
                    );
                    return Command.repeat();
                }
                const success = await this.autoUpdaterModuleManager.update();

                if (success) {
                    const updateFilePath = this.fileService.getUpdateFilePath();
                    await fs.promises.writeFile(updateFilePath, 'UPDATED');
                    this.logger.info('Node will now restart!');
                    process.exit(1);
                }
                this.logger.info('Unable to update ot-node to new version.');
            } else {
                this.logger.info('Your node is running on the latest version!');
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
