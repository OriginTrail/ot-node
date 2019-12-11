const Command = require('../command');
const models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Increases approval for Bidding contract on blockchain
 */
class ReputationUpdateCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const earliestTimestampToKeep =
            Date.now() - (this.config.reputationWindowInMinutes * 60 * 1000);
        await models.reputation_data.destroy({
            where: {
                timestamp: { [models.Sequelize.Op.lt]: earliestTimestampToKeep },
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
            name: 'reputationUpdateCommand',
            data: {
            },
            period: constants.DEFAULT_REPUTATION_UPDATE_PERIOD_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ReputationUpdateCommand;
