const Command = require('../command');
const models = require('../../../models/index');

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
            challengeId,
            offerId,
            dhIdentity,
            blockId,
            litigationPrivateKey,
        } = command.data;

        const challenge = await models.challenges.findOne({ where: { id: challengeId } });

        if (challenge.answer === challenge.expected_answer) {
            this.logger.trace('Successfully answered to challenge.');
            return Command.empty();
        }

        this.logger.info(`Wrong answer to challenge '${challenge.answer} for DH ID ${challenge.dh_id}.'`);
        return {
            commands: [
                {
                    name: 'dcLitigationInitiateCommand',
                    period: 5000,
                    data: {
                        offerId,
                        blockId,
                        dhIdentity,
                        litigationPrivateKey,
                    },
                },
            ],
        };
    }
}

module.exports = DCChallengeCommand;
