const Command = require('../command');
const Models = require('../../../models/index');

/**
 * Increases approval for Bidding contract on blockchain
 */
class CleanerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        await Models.commands.destroy({
            where: {
                status: { [Models.Sequelize.Op.in]: ['COMPLETED', 'FAILED', 'EXPIRED'] },
                started_at: { [Models.Sequelize.Op.lte]: Date.now() },
            },
            transaction,
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
            period: 60 * 60 * 1000,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = CleanerCommand;
