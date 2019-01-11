const { forEach, filter } = require('p-iteration');

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
        this.blockchain = ctx.blockchain;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        try {
            const candidates = await this._getLitigationCandidates();

            forEach(candidates, async (candidate) => {
                candidate.status = 'CHALLENGING';
                await candidate.save({ fields: ['status'] });

                this.commandExecutor.add({
                    name: 'dcChallengeCommand',
                    delay: 0,
                    data: {
                        dhId: candidate.dh_id,
                        dhIdentity: candidate.dh_identity,
                        offerId: candidate.offer_id,
                        litigationPrivateKey: candidate.litigation_private_key,
                    },
                    transactional: false,
                });
            });
        } catch (e) {
            this.logger.error(`Failed to process dcChallengesCommand. ${e}`);
        }
        return Command.repeat();
    }

    /**
     * Get holders that can be litigated
     * @return {Promise<Array<Model>>}
     * @private
     */
    async _getLitigationCandidates() {
        const potentialCandidates = await models.replicated_data.findAll({
            where: {
                status: 'HOLDING',
            },
        });

        return filter(potentialCandidates, async (candidate) => {
            const offer = await models.offers.findOne({
                where: {
                    offer_id: candidate.offer_id,
                },
            });

            if (offer == null) {
                this.logger.warn(`Failed to find offer ${candidate.offer_id}. Possible database corruption.`);
                return false;
            }

            const litigationIntervalMills = offer.litigation_interval_in_minutes * 60 * 1000;
            const litigationTimestampMills = await this.blockchain.getLitigationTimestamp(
                offer.offer_id,
                candidate.dh_identity,
            ) * 1000;

            return Date.now() + litigationIntervalMills > litigationTimestampMills;
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
