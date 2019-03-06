const { forEach, filter } = require('p-iteration');

const Command = require('../command');
const models = require('../../../models/index');
const utilities = require('../../Utilities');

/**
 * Challenge holders for active offers
 */
class DCChallengesCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
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
            const { litigationEnabled } = this.config;
            if (litigationEnabled === false) {
                // skip challenges - return repeat for potential config live update
                return Command.repeat();
            }

            const challenges = await this._getChallenges();

            await forEach(challenges, async (challenge) => {
                const challenged = await models.replicated_data.findOne({
                    where: {
                        dh_id: challenge.dh_id,
                        offer_id: challenge.offer_id,
                    },
                });

                if (challenged.status !== 'HOLDING') {
                    return;
                }

                challenge.status = 'IN_PROGRESS';
                await challenge.save({ fields: ['status'] });


                challenged.status = 'CHALLENGING';
                await challenged.save({ fields: ['status'] });

                this.commandExecutor.add({
                    name: 'dcChallengeCommand',
                    delay: 0,
                    data: {
                        challenge_id: challenge.id,
                        litigationPrivateKey: challenged.litigation_private_key,
                    },
                    transactional: false,
                });
            });
        } catch (e) {
            this.logger.error(`Failed to process dcChallengesCommand. ${e.stack}`);
        }
        return Command.repeat();
    }

    /**
     * Get challenges for holding nodes
     * @return {Promise<Map<Model>>}
     * @private
     */
    async _getChallenges() {
        const challenges = await models.challenges.findAll({
            where: {
                status: 'PENDING',
                start_time: { [models.Sequelize.Op.gte]: Date.now() },
            },
        });

        const groupedByDhId = utilities.groupBy(challenges, challenge => challenge.dh_id);

        const unique = [];
        groupedByDhId.forEach((value) => {
            if (value.length > 0) {
                unique.push(value[0]);
            }
        });

        return filter(unique, async (challenge) => {
            const offer = await models.offers.findOne({
                where: {
                    offer_id: challenge.offer_id,
                },
            });

            if (offer == null) {
                this.logger.error(`Failed to find offer ${challenge.offer_id}. Possible database corruption.`);
                return false;
            }

            const litigationIntervalMills = offer.litigation_interval_in_minutes * 60 * 1000;
            const litigationTimestampMills = await this.blockchain.getLitigationTimestamp(
                offer.offer_id,
                challenge.dh_identity,
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
