const Command = require('../command');
const Models = require('../../../models/index');
const constants = require('../../../src/constants/constants');

/**
 * Removes commands that have status: completed, failed, expired
 */
class CleanerCommand extends Command {
    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        await Models.commands.destroy({
            where: {
                status: { [Models.Sequelize.Op.in]: ['COMPLETED', 'FAILED', 'EXPIRED'] },
                started_at: { [Models.Sequelize.Op.lte]: Date.now() },
            },
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
            name: 'cleanerCommand',
            data: {
            },
            period: constants.DEFAULT_COMMAND_CLEANUP_TIME_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = CleanerCommand;
