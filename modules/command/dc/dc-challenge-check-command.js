const Command = require('../command');
const models = require('../../../models');

/**
 *  Challenges one DH
 */
class DCChallengeCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.transport = ctx.transport;
        this.graphStorage = ctx.graphStorage;
        this.challengeService = ctx.challengeService;
    }

    /**
     * Executes command and produces one or more events
     * @param command - Command object
     * @param [transaction] - Optional database transaction
     */
    async execute(command, transaction) {
        const {
            dhId,
            challengeId,
            offerId,
            dhIdentity,
            litigationPrivateKey,
        } = command.data;

        const challenge = await models.challenges.findOne({ where: { id: challengeId } });

        const replicatedData = await models.replicated_data.findOne({
            where:
                {
                    offer_id: offerId, dh_id: dhId,
                },
        });

        if (challenge.answer === challenge.expected_answer) {
            this.logger.trace('Successfully answered to challenge.');

            replicatedData.status = 'HOLDING';
            await replicatedData.save({ fields: ['status'] });

            challenge.status = 'SUCCESSFUL';
            await challenge.save({ fields: ['status'] });
            return Command.empty();
        }

        this.logger.info(`Wrong answer to challenge '${challenge.id}' for DH ID ${challenge.dh_id}. Got ${challenge.answer} for expected answer ${challenge.expected_answer}.`);
        return {
            commands: [
                {
                    name: 'dcLitigationInitiateCommand',
                    period: 5000,
                    data: {
                        offerId,
                        blockId: challenge.block_id,
                        dhIdentity,
                        litigationPrivateKey,
                    },
                },
            ],
        };
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
            name: 'dcChallengeCheckCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCChallengeCommand;
