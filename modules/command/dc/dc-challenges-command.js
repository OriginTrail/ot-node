const Command = require('../command');
const models = require('../../../models/index');

/**
 * Challenge holders for active offers
 */
class DCChallengesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.dcService = ctx.dcService;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        try {
            const litigationCandidates = await DCChallengesCommand._getLitigationCandidates();
            if (litigationCandidates.length === 0) {
                return Command.repeat();
            }

            await this.dcService.handleChallenges(litigationCandidates);
        } catch (e) {
            this.logger.error(`Failed to process ChallengesCommand. ${e}`);
        }
        return Command.repeat();
    }

    /**
     * Get holders that can be litigated
     * @return {Promise<Array<Model>>}
     * @private
     */
    static async _getLitigationCandidates() {
        return models.replicated_data.findAll({
            where: {
                status: 'HOLDING',
            },
        });
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            data: {
            },
            delay: 5000,
            period: 5000,
            name: 'dcChallengesCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCChallengesCommand;
