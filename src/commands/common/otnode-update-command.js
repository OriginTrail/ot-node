import semver from 'semver';
import Command from '../command.js';

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
     */
    async execute(command) {
        if (!this.config.modules.autoUpdater.enabled) {
            return Command.empty();
        }
        try {
            this.logger.info('Checking for new updates...', command);
            const { upToDate, currentVersion, remoteVersion } =
                await this.autoUpdaterModuleManager.compareVersions();
            if (!upToDate) {
                if (semver.major(currentVersion) < semver.major(remoteVersion)) {
                    this.logger.info(
                        `A new major update is available. ` +
                            `Please run the update to version ${remoteVersion} manually.`,
                        command,
                    );
                    return Command.repeat();
                }
                if (semver.lt(semver.valid(remoteVersion), semver.valid(currentVersion))) {
                    this.logger.info(
                        'The remote version is older than the current version; ' +
                            'therefore, the update will be skipped.',
                        command,
                    );
                    return Command.repeat();
                }
                const success = await this.autoUpdaterModuleManager.update();

                if (success) {
                    const updateFolderPath = this.fileService.getDataFolderPath();
                    await this.fileService.writeContentsToFile(
                        updateFolderPath,
                        'UPDATED',
                        'UPDATED',
                    );
                    this.logger.info('OtnodeUpdateCommand: Node will now restart!');
                    process.exit(1);
                }
                this.logger.info('Unable to update ot-node to the new version.', command);
            } else {
                this.logger.info('Your node is running on the latest version!', command);
            }
        } catch (err) {
            await this.handleError(command, err);
        }
        return Command.repeat();
    }

    async recover(command, error) {
        this.logger.error(
            `Error occurred during the command execution; ` +
                `Error Message: ${error.message}. Repeating the command...`,
            command,
        );
        return Command.repeat();
    }

    async handleError(command, error) {
        this.logger.error(
            `Error occurred during the command execution; ` +
                `Error Message: ${error.message}; Error Stack: ${error.stack}.`,
            command,
        );
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

export default OtnodeUpdateCommand;
