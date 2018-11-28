const Command = require('../command');
const models = require('../../../models/index');

/**
 * Challenge holders for active offers
 */
class DCChallengesCommand extends Command {
    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const litigationCandidates = await DCChallengesCommand._getLitigationCandidates();
        if (litigationCandidates.length === 0) {
            return Command.repeat();
        }

        const challengeCommands = litigationCandidates.map(candidate => ({
            name: 'dcChallengeCommand',
            delay: 0,
            data: {
                dhId: candidate.dh_id,
                dhIdentity: candidate.dh_identity,
                offerId: candidate.offer_id,
                litigationPrivateKey: candidate.litigation_private_key,
            },
            transactional: false,
        }));

        return {
            commands: challengeCommands.concat([this.default()]),
        };
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
